/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AdBreakInfo, AdInfo, TrackAds } from '@amazon/vinyl'
import { AdControllerImpl } from '@amazon/vinyl'
import { MockPlaybackController } from '@amazon/vinyl/vinylTestUtil'
import type { MaybePromise } from '@amazon/vinyl-util'

describe('AdControllerImpl', () => {
    let playbackController: MockPlaybackController

    beforeEach(() => {
        playbackController = new MockPlaybackController()
    })

    function createController() {
        return new AdControllerImpl({ playbackController })
    }

    function updateTime(time: number) {
        playbackController.currentTime = time
        playbackController.dispatch('timeUpdate', {
            previous: 0,
            current: time,
        })
    }

    /** Simulates a user seek: moves the playhead and fires `seeked`. */
    function seekTo(time: number) {
        playbackController.currentTime = time
        playbackController.dispatch('seeked', {
            started: 0,
            ended: 0,
            duration: 0,
            reason: 'seeked',
        })
    }

    const defaultAd: AdInfo = {
        id: 'a1',
        startTime: 10,
        duration: 5,
        uri: 'ad.m3u8',
    }

    /**
     * Builds an ad break. `ads` accepts a plain array (wrapped in an immediate
     * resolver) or a resolver function for async cases.
     */
    function makeBreak(
        overrides: Partial<Omit<AdBreakInfo, 'ads'>> & {
            ads?:
                | MaybePromise<readonly AdInfo[]>
                | (() => MaybePromise<readonly AdInfo[]>)
        } = {}
    ): AdBreakInfo {
        const { ads, ...rest } = overrides
        const adsResolver =
            typeof ads === 'function'
                ? ads
                : () => Promise.resolve(ads ?? [defaultAd])
        return {
            id: 'b1',
            startTime: 10,
            duration: 5,
            placement: 'midroll',
            restrict: {},
            once: false,
            resumeOffset: null,
            playoutLimit: null,
            skipControl: () => null,
            ads: adsResolver,
            ...rest,
        }
    }

    /** Wraps ad breaks in the TrackAds shape accepted by setAds. */
    function trackAds(...adBreaks: readonly AdBreakInfo[]): TrackAds {
        return { trackUri: 't1', adBreaks }
    }

    /** Waits for pending microtasks (ad resolution) to settle. */
    async function flush(): Promise<void> {
        await Promise.resolve()
        await Promise.resolve()
    }

    it('starts with no ads and no active break', () => {
        const c = createController()
        expect(c.currentTrackAds).toBeNull()
        expect(c.currentAdBreak).toBeNull()
        expect(c.currentAd).toBeNull()
    })

    it('emits currentTrackAdsChange with the TrackAds when set', () => {
        const c = createController()
        const events: (TrackAds | null)[] = []
        c.on('currentTrackAdsChange', (e) => events.push(e.current))
        c.setAds(trackAds(makeBreak()))
        expect(events.length).toBe(1)
        expect(events[0]?.adBreaks.map((b) => b.id)).toEqual(['b1'])
        expect(c.currentTrackAds?.adBreaks.map((b) => b.id)).toEqual(['b1'])
    })

    it('clears the ads when set to null', () => {
        const c = createController()
        c.setAds(trackAds(makeBreak()))
        c.setAds(null)
        expect(c.currentTrackAds).toBeNull()
    })

    describe('midroll entry', () => {
        it('activates a break when the playhead crosses its start time', async () => {
            const c = createController()
            c.setAds(trackAds(makeBreak({ startTime: 10, duration: 5 })))
            const entered: (string | null)[] = []
            c.on('currentAdBreakChange', (e) =>
                entered.push(e.current?.id ?? null)
            )

            updateTime(9)
            await flush()
            expect(entered).toEqual([])
            expect(c.currentAdBreak).toBeNull()

            updateTime(10)
            await flush()
            expect(entered).toEqual(['b1'])
            expect(c.currentAdBreak?.id).toBe('b1')
            expect(c.currentAd?.id).toBe('a1')
        })

        it('does not re-emit while remaining inside the same break', async () => {
            const c = createController()
            c.setAds(trackAds(makeBreak({ startTime: 10, duration: 10 })))
            let changes = 0
            c.on('currentAdBreakChange', () => changes++)
            updateTime(11)
            await flush()
            updateTime(12)
            updateTime(13)
            await flush()
            expect(changes).toBe(1)
        })

        it('treats a null-duration break as open-ended (still enters)', async () => {
            const c = createController()
            c.setAds(trackAds(makeBreak({ startTime: 10, duration: null })))
            updateTime(11)
            await flush()
            expect(c.currentAdBreak?.id).toBe('b1')
        })
    })

    describe('preroll', () => {
        it('activates immediately when ads are set', async () => {
            const c = createController()
            c.setAds(
                trackAds(
                    makeBreak({ id: 'pre', startTime: 0, placement: 'preroll' })
                )
            )
            // The break is set synchronously; the ad resolves on the microtask.
            expect(c.currentAdBreak?.id).toBe('pre')
            await flush()
            expect(c.currentAd?.id).toBe('a1')
        })

        // Regression: a long preroll's end position must not be mistaken for a
        // content position and trip a midroll before content resumes. Midroll
        // cues key off the CONTENT playhead, not the ad track's leftover time.
        it('does not trip a midroll from the ended preroll ad-track playhead', async () => {
            const c = createController()
            const entered: string[] = []
            c.on('currentAdBreakChange', (e) => {
                if (e.current) entered.push(e.current.placement)
            })
            // A preroll at 0 and a midroll at 5s whose duration is unknown, so
            // its active window is unbounded until the asset resolves — any time
            // at or past 5s would enter it.
            c.setAds(
                trackAds(
                    makeBreak({
                        id: 'pre',
                        startTime: 0,
                        placement: 'preroll',
                        ads: [
                            {
                                id: 'pa',
                                startTime: 0,
                                duration: null,
                                uri: 'pre.m3u8',
                            },
                        ],
                    }),
                    makeBreak({
                        id: 'mid',
                        startTime: 5,
                        duration: null,
                        placement: 'midroll',
                    })
                )
            )
            await flush()
            expect(c.currentAdBreak?.placement).toBe('preroll')

            // The preroll plays; the element's currentTime advances along the AD
            // track well past the midroll's start. While the break is active
            // this is the ad's playhead, not a content position.
            playbackController.currentTime = 30
            updateTime(30)
            expect(c.currentAdBreak?.placement).toBe('preroll')

            // The preroll ends. Its ad-track playhead (30s) is still reported
            // until the content source swaps back in; a stale time update in
            // this window must NOT enter the midroll.
            playbackController.dispatch('ended', {
                previous: false,
                current: true,
            })
            await flush()
            updateTime(30)
            await flush()
            expect(entered).toEqual(['preroll'])
            expect(c.currentAdBreak).toBeNull()

            // Content resumes at 0 (the ad→content swap fires `emptied`) and
            // plays forward; the midroll enters only when the CONTENT playhead
            // reaches its start.
            playbackController.currentTime = 0
            playbackController.dispatch('emptied', {})
            updateTime(1)
            await flush()
            expect(c.currentAdBreak).toBeNull()
            updateTime(6)
            await flush()
            expect(c.currentAdBreak?.placement).toBe('midroll')
            expect(entered).toEqual(['preroll', 'midroll'])
        })

        // Regression: a bare user seek in the post-break/pre-`emptied` window is
        // not proof content resumed — the ad playhead is still resident — so it
        // must not disarm the gate. Only `emptied` (the swap) clears it.
        it('a user seek before the content swap does not trip a midroll off the stale ad time', async () => {
            const c = createController()
            const entered: string[] = []
            c.on('currentAdBreakChange', (e) => {
                if (e.current) entered.push(e.current.placement)
            })
            c.setAds(
                trackAds(
                    makeBreak({
                        id: 'pre',
                        startTime: 0,
                        placement: 'preroll',
                        ads: [
                            {
                                id: 'pa',
                                startTime: 0,
                                duration: null,
                                uri: 'pre.m3u8',
                            },
                        ],
                    }),
                    makeBreak({
                        id: 'mid',
                        startTime: 5,
                        duration: null,
                        placement: 'midroll',
                    })
                )
            )
            await flush()
            // The preroll plays to t=30 (past the 5s midroll cue) and ends,
            // arming the gate.
            playbackController.currentTime = 30
            updateTime(30)
            playbackController.dispatch('ended', {
                previous: false,
                current: true,
            })
            await flush()
            expect(c.currentAdBreak).toBeNull()

            // A user seek arrives before the content source swaps in; the
            // element still reports the stale ad playhead. It must not disarm
            // the gate, so the midroll must not enter.
            seekTo(30)
            updateTime(30)
            await flush()
            expect(entered).toEqual(['preroll'])
            expect(c.currentAdBreak).toBeNull()

            // Only once `emptied` swaps content in and the content playhead
            // forward-crosses the cue does the midroll enter.
            playbackController.currentTime = 0
            playbackController.dispatch('emptied', {})
            updateTime(6)
            await flush()
            expect(c.currentAdBreak?.placement).toBe('midroll')
            expect(entered).toEqual(['preroll', 'midroll'])
        })
    })

    describe('skipAd', () => {
        function multiAdBreak(): AdBreakInfo {
            return makeBreak({
                id: 'b1',
                startTime: 0,
                duration: 30,
                ads: [
                    { id: 'a1', startTime: 0, duration: 10, uri: 'ad1.m3u8' },
                    { id: 'a2', startTime: 10, duration: 20, uri: 'ad2.m3u8' },
                ],
            })
        }

        it('advances to the next ad within a multi-ad break', async () => {
            const c = createController()
            c.setAds(trackAds(multiAdBreak()))
            updateTime(1)
            await flush()
            expect(c.currentAd?.id).toBe('a1')
            c.skipAd()
            expect(c.currentAd?.id).toBe('a2')
            expect(c.currentAdBreak?.id).toBe('b1')
        })

        it('ends the break after skipping the last ad', async () => {
            const c = createController()
            c.setAds(trackAds(multiAdBreak()))
            updateTime(1)
            await flush()
            c.skipAd() // to a2
            const changes: (string | null)[] = []
            c.on('currentAdBreakChange', (e) =>
                changes.push(e.current?.id ?? null)
            )
            c.skipAd() // past last -> break ends
            expect(changes).toEqual([null])
            expect(c.currentAdBreak).toBeNull()
        })

        it('is a no-op when no ad is active', () => {
            const c = createController()
            c.setAds(trackAds(makeBreak()))
            const spy = jasmine.createSpy('currentAdBreakChange')
            c.on('currentAdBreakChange', spy)
            c.skipAd()
            expect(spy).not.toHaveBeenCalled()
        })

        it('prevents re-entry into a skipped single-ad break', async () => {
            const c = createController()
            c.setAds(trackAds(makeBreak({ startTime: 0, duration: 10 })))
            updateTime(5)
            await flush()
            c.skipAd()
            const spy = jasmine.createSpy('currentAdBreakChange')
            c.on('currentAdBreakChange', spy)
            updateTime(7)
            await flush()
            expect(spy).not.toHaveBeenCalled()
            expect(c.currentAdBreak).toBeNull()
        })
    })

    describe('skipAdBreak', () => {
        it('is a no-op when no break is active', () => {
            const c = createController()
            const spy = jasmine.createSpy('currentAdBreakChange')
            c.on('currentAdBreakChange', spy)
            c.skipAdBreak()
            expect(spy).not.toHaveBeenCalled()
        })

        it('skips the entire active break', async () => {
            const c = createController()
            c.setAds(
                trackAds(
                    makeBreak({
                        startTime: 0,
                        duration: 30,
                        ads: [
                            {
                                id: 'a1',
                                startTime: 0,
                                duration: 10,
                                uri: 'ad1.m3u8',
                            },
                            {
                                id: 'a2',
                                startTime: 10,
                                duration: 20,
                                uri: 'ad2.m3u8',
                            },
                        ],
                    })
                )
            )
            updateTime(1)
            await flush()
            const events: (string | null)[] = []
            c.on('currentAdBreakChange', (e) =>
                events.push(e.current?.id ?? null)
            )
            c.skipAdBreak()
            expect(events).toEqual([null])
            expect(c.currentAdBreak).toBeNull()
            // Not re-entered by a later time update within its range.
            updateTime(5)
            await flush()
            expect(c.currentAdBreak).toBeNull()
        })
    })

    describe('clearCompletedAds', () => {
        it('allows a previously skipped break to be entered again', async () => {
            const c = createController()
            c.setAds(trackAds(makeBreak({ startTime: 0, duration: 10 })))
            updateTime(5)
            await flush()
            c.skipAd()
            expect(c.currentAdBreak).toBeNull()

            c.clearCompletedAds()
            updateTime(6)
            await flush()
            expect(c.currentAdBreak?.id).toBe('b1')
        })
    })

    describe('empty / failing ad lists', () => {
        it('completes a break whose resolver returns no ads', async () => {
            const c = createController()
            c.setAds(
                trackAds(makeBreak({ startTime: 0, duration: 10, ads: [] }))
            )
            updateTime(5)
            await flush()
            expect(c.currentAdBreak).toBeNull()
            updateTime(7)
            await flush()
            expect(c.currentAdBreak).toBeNull()
        })

        it('emits adError and clears the break when the resolver rejects', async () => {
            const c = createController()
            const errors: unknown[] = []
            c.on('adError', (e) => errors.push(e.error))
            c.setAds(
                trackAds(
                    makeBreak({
                        startTime: 0,
                        duration: 10,
                        ads: () => Promise.reject(new Error('boom')),
                    })
                )
            )
            updateTime(5)
            await flush()
            expect(errors.length).toBe(1)
            expect(c.currentAdBreak).toBeNull()
        })

        // A no-fill / failed-resolve break completes without any ad taking over
        // the media element, so there is no ad→content swap to re-establish the
        // content playhead. Such a break must not gate later midrolls, or every
        // subsequent midroll in the session would be silently dropped.
        it('does not suppress a later midroll after a no-fill break', async () => {
            const c = createController()
            const entered: string[] = []
            c.on('currentAdBreakChange', (e) => {
                if (e.current) entered.push(e.current.id)
            })
            c.setAds(
                trackAds(
                    makeBreak({
                        id: 'mid1',
                        startTime: 5,
                        duration: 10,
                        ads: [],
                    }),
                    makeBreak({ id: 'mid2', startTime: 20, duration: 10 })
                )
            )
            updateTime(6)
            await flush()
            expect(c.currentAdBreak).toBeNull()
            updateTime(21)
            await flush()
            expect(c.currentAdBreak?.id).toBe('mid2')
            expect(entered).toEqual(['mid1', 'mid2'])
        })

        it('does not suppress a later midroll after a failed ad-list resolve', async () => {
            const c = createController()
            const errors: unknown[] = []
            c.on('adError', (e) => errors.push(e.error))
            c.setAds(
                trackAds(
                    makeBreak({
                        id: 'mid1',
                        startTime: 5,
                        duration: 10,
                        ads: () => Promise.reject(new Error('no ads')),
                    }),
                    makeBreak({ id: 'mid2', startTime: 20, duration: 10 })
                )
            )
            updateTime(6)
            await flush()
            expect(errors.length).toBe(1)
            expect(c.currentAdBreak).toBeNull()
            updateTime(21)
            await flush()
            expect(c.currentAdBreak?.id).toBe('mid2')
        })
    })

    describe('failAd', () => {
        it('emits adError carrying the failing ad and completes it', async () => {
            const c = createController()
            const errorEvents: {
                adId: string | null
                breakId: string
            }[] = []
            c.on('adError', (e) =>
                errorEvents.push({
                    adId: e.currentAd?.id ?? null,
                    breakId: e.adBreak.id,
                })
            )
            const completed: string[] = []
            c.on('adCompleted', (e) => completed.push(e.reason))
            c.setAds(trackAds(makeBreak({ startTime: 0, duration: 10 })))
            updateTime(5)
            await flush()
            expect(c.currentAd?.id).toBe('a1')

            c.failAd(new Error('decode failed'))
            expect(errorEvents).toEqual([{ adId: 'a1', breakId: 'b1' }])
            expect(completed).toEqual(['error'])
            expect(c.currentAdBreak).toBeNull()
        })

        it('is a no-op when no break is active', () => {
            const c = createController()
            const spy = jasmine.createSpy('adError')
            c.on('adError', spy)
            c.failAd(new Error('boom'))
            expect(spy).not.toHaveBeenCalled()
        })
    })

    describe('enterPostroll', () => {
        it('activates a pending postroll break', async () => {
            const c = createController()
            c.setAds(
                trackAds(
                    makeBreak({
                        id: 'post',
                        startTime: 60,
                        duration: 10,
                        placement: 'postroll',
                    })
                )
            )
            // A postroll is not entered by the playhead crossing its range.
            updateTime(60)
            await flush()
            expect(c.currentAdBreak).toBeNull()

            c.enterPostroll()
            expect(c.currentAdBreak?.id).toBe('post')
            await flush()
            expect(c.currentAd?.id).toBe('a1')
        })
    })

    describe('playback progress events', () => {
        it('dispatches adEntered and adPlaying', async () => {
            const c = createController()
            const entered: string[] = []
            const playing: string[] = []
            c.on('adEntered', (e) => entered.push(e.ad.id))
            c.on('adPlaying', (e) => playing.push(e.ad.id))
            c.setAds(trackAds(makeBreak({ startTime: 0, duration: 10 })))
            updateTime(1)
            await flush()
            expect(entered).toEqual(['a1'])

            playbackController.dispatch('playing', {})
            expect(playing).toEqual(['a1'])
        })

        it('dispatches adEnded when playback ends', async () => {
            const c = createController()
            const ended: string[] = []
            c.on('adEnded', (e) => ended.push(e.ad.id))
            c.setAds(trackAds(makeBreak({ startTime: 0, duration: 10 })))
            updateTime(1)
            await flush()
            playbackController.dispatch('ended', {
                previous: false,
                current: true,
            })
            expect(ended).toEqual(['a1'])
            expect(c.currentAdBreak).toBeNull()
        })

        it('dispatches adFirstQuartile after 25% of the ad has played', async () => {
            const c = createController()
            const quartiles: string[] = []
            c.on('adFirstQuartile', (e) => quartiles.push(e.ad.id))
            c.setAds(trackAds(makeBreak({ startTime: 0, duration: 10 })))
            updateTime(0)
            await flush()
            // Ad begins playing at time 0.
            playbackController.dispatch('playing', {})
            playbackController.duration = 10
            playbackController.playbackRate = 1
            playbackController.currentTimePercent = 0.3
            updateTime(3)
            expect(quartiles).toEqual(['a1'])
        })

        it('dispatches adMidpoint after 50% of the ad has played', async () => {
            const c = createController()
            const midpoints: number[] = []
            c.on('adMidpoint', (e) => midpoints.push(e.playbackRateAvg))
            c.setAds(trackAds(makeBreak({ startTime: 0, duration: 10 })))
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {})
            playbackController.duration = 10
            playbackController.playbackRate = 1
            playbackController.currentTimePercent = 0.6
            updateTime(6)
            expect(midpoints.length).toBe(1)
        })

        it('dispatches adThirdQuartile after 75% of the ad has played', async () => {
            const c = createController()
            const thirds: string[] = []
            c.on('adThirdQuartile', (e) => thirds.push(e.ad.id))
            c.setAds(trackAds(makeBreak({ startTime: 0, duration: 10 })))
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {})
            playbackController.duration = 10
            playbackController.playbackRate = 1
            playbackController.currentTimePercent = 0.8
            updateTime(8)
            expect(thirds).toEqual(['a1'])
        })

        it('fails the ad if it does not start within the load timeout', async () => {
            const c = new AdControllerImpl(
                { playbackController },
                { adLoadTimeout: 0 }
            )
            const errors: unknown[] = []
            c.on('adError', (e) => errors.push(e.error))
            c.setAds(trackAds(makeBreak({ startTime: 0, duration: 10 })))
            updateTime(1)
            // Never dispatch 'playing'; wait for the (zero-second) load timeout
            // to elapse and fail the ad.
            await flush()
            await new Promise((resolve) => setTimeout(resolve, 5))
            expect(errors.length).toBe(1)
            expect(c.currentAdBreak).toBeNull()
        })
    })

    describe('edge cases', () => {
        it('tears down an active ad when ads for a different track are set', async () => {
            const c = createController()
            c.setAds(trackAds(makeBreak({ startTime: 0, duration: 10 })))
            updateTime(1)
            await flush()
            expect(c.currentAd?.id).toBe('a1')
            const changes: (string | null)[] = []
            c.on('currentAdBreakChange', (e) =>
                changes.push(e.current?.id ?? null)
            )
            // A content change sets ads for a different track (or clears them);
            // the in-flight ad must not leak into the new presentation.
            c.setAds({ trackUri: 't2', adBreaks: [] })
            expect(c.currentAd).toBeNull()
            expect(c.currentAdBreak).toBeNull()
            expect(changes).toEqual([null])
        })

        it('ignores an ended event when no ad is active', () => {
            const c = createController()
            const ended = jasmine.createSpy('adEnded')
            c.on('adEnded', ended)
            playbackController.dispatch('ended', {
                previous: false,
                current: true,
            })
            expect(ended).not.toHaveBeenCalled()
        })

        it('does not start another ad while one is active', async () => {
            const c = createController()
            c.setAds(trackAds(makeBreak({ startTime: 0, duration: 10 })))
            updateTime(1)
            await flush()
            expect(c.currentAd?.id).toBe('a1')

            // A live manifest update arrives mid-ad; the active ad must not be
            // interrupted by a newly pending break.
            c.setAds(
                trackAds(
                    makeBreak({ id: 'pre', startTime: 0, placement: 'preroll' })
                )
            )
            expect(c.currentAd?.id).toBe('a1')
        })

        it('stops scanning midrolls once the next is past the playhead', async () => {
            const c = createController()
            c.setAds(
                trackAds(
                    makeBreak({ id: 'near', startTime: 5, duration: 10 }),
                    makeBreak({ id: 'far', startTime: 50, duration: 10 })
                )
            )
            updateTime(6)
            await flush()
            expect(c.currentAdBreak?.id).toBe('near')
        })
    })

    describe('X-RESUME-OFFSET resume position', () => {
        function resumesOf(c: AdControllerImpl): number[] {
            const resumes: number[] = []
            c.on('adCompleted', (e) => resumes.push(e.resumePosition))
            return resumes
        }

        it('resumes at the scheduled start plus a present offset', async () => {
            const c = createController()
            const resumes = resumesOf(c)
            c.setAds(
                trackAds(
                    makeBreak({ startTime: 10, duration: 6, resumeOffset: 5 })
                )
            )
            updateTime(10)
            await flush()
            expect(c.currentAd?.id).toBe('a1')
            c.skipAd()
            expect(resumes.at(-1)).toBe(15)
        })

        it('treats a present offset of 0 as resume-in-place', async () => {
            const c = createController()
            const resumes = resumesOf(c)
            c.setAds(
                trackAds(
                    makeBreak({ startTime: 10, duration: 6, resumeOffset: 0 })
                )
            )
            updateTime(10)
            await flush()
            c.skipAd()
            expect(resumes.at(-1)).toBe(10)
        })

        it('clamps a negative offset to the natural resume position', async () => {
            const c = createController()
            const resumes = resumesOf(c)
            c.setAds(
                trackAds(
                    makeBreak({ startTime: 10, duration: 6, resumeOffset: -4 })
                )
            )
            updateTime(10)
            await flush()
            c.skipAd()
            expect(resumes.at(-1)).toBe(10)
        })

        it('defaults an absent offset to the actual playout duration', async () => {
            const c = createController()
            const resumes = resumesOf(c)
            c.setAds(
                trackAds(
                    makeBreak({
                        startTime: 10,
                        duration: 20,
                        // Null per-ad duration so the per-ad cap does not end it.
                        ads: [
                            {
                                id: 'a1',
                                startTime: 0,
                                duration: null,
                                uri: 'ad.m3u8',
                            },
                        ],
                    })
                )
            )
            updateTime(10)
            await flush()
            playbackController.dispatch('playing', {}) // timeStart = 10
            updateTime(16) // played 6s; no per-ad/pod cap applies
            playbackController.dispatch('ended', {
                previous: false,
                current: true,
            })
            expect(resumes.at(-1)).toBe(16)
        })

        it('re-baselines ad playout timing on a seek within the ad', async () => {
            const c = createController()
            const resumes: number[] = []
            c.on('adCompleted', (e) => resumes.push(e.resumePosition))
            c.setAds(
                trackAds(
                    makeBreak({
                        startTime: 10,
                        duration: 20,
                        ads: [
                            {
                                id: 'a1',
                                startTime: 0,
                                duration: null,
                                uri: 'ad.m3u8',
                            },
                        ],
                    })
                )
            )
            updateTime(10)
            await flush()
            playbackController.dispatch('playing', {}) // timeStart = 10
            seekTo(14) // seek within the ad → playout timing re-baselines to 14
            updateTime(18) // 4s played since the seek
            playbackController.dispatch('ended', {
                previous: false,
                current: true,
            })
            // Absent offset → resume at start (10) + playout measured from the
            // seek (18 - 14 = 4) = 14.
            expect(resumes.at(-1)).toBe(14)
        })

        it('parks a postroll resume at the content end, not past it', async () => {
            const c = createController()
            const resumes: number[] = []
            c.on('adCompleted', (e) => resumes.push(e.resumePosition))
            playbackController.duration = 100
            c.setAds(
                trackAds(
                    makeBreak({
                        id: 'post',
                        startTime: 100,
                        duration: 10,
                        placement: 'postroll',
                        ads: [
                            {
                                id: 'a1',
                                startTime: 0,
                                duration: null,
                                uri: 'ad.m3u8',
                            },
                        ],
                    })
                )
            )
            c.enterPostroll() // lastPlaybackTime = duration (100)
            await flush()
            playbackController.dispatch('playing', {}) // timeStart = 0
            playbackController.currentTime = 8 // ad played 8s
            playbackController.dispatch('ended', {
                previous: false,
                current: true,
            })
            // The offset math must not apply to a postroll: it parks at the
            // content end (100), not startTime + playout (108).
            expect(resumes.at(-1)).toBe(100)
        })

        it('preserves a forward seek into the break over the offset', async () => {
            const c = createController()
            const resumes = resumesOf(c)
            c.setAds(
                trackAds(
                    makeBreak({ startTime: 10, duration: 6, resumeOffset: 2 })
                )
            )
            updateTime(13) // seek/enter at 13; natural resume = 13 > 10 + 2
            await flush()
            c.skipAd()
            expect(resumes.at(-1)).toBe(13)
        })
    })

    describe('ad duration and playout limits', () => {
        it('advances to the next ad when one reaches its declared duration', async () => {
            const c = createController()
            c.setAds(
                trackAds(
                    makeBreak({
                        startTime: 0,
                        duration: 30,
                        ads: [
                            {
                                id: 'a1',
                                startTime: 0,
                                duration: 5,
                                uri: 'ad1.m3u8',
                            },
                            {
                                id: 'a2',
                                startTime: 0,
                                duration: 20,
                                uri: 'ad2.m3u8',
                            },
                        ],
                    })
                )
            )
            updateTime(0)
            await flush()
            expect(c.currentAd?.id).toBe('a1')
            playbackController.dispatch('playing', {}) // timeStart = 0
            updateTime(6) // elapsed 6 >= a1.duration 5 → advance
            expect(c.currentAd?.id).toBe('a2')
        })

        it('ends the whole break when the playout limit is reached, dropping remaining ads', async () => {
            const c = createController()
            const resumes: number[] = []
            c.on('adCompleted', (e) => resumes.push(e.resumePosition))
            c.setAds(
                trackAds(
                    makeBreak({
                        startTime: 0,
                        duration: null,
                        playoutLimit: 8,
                        ads: [
                            {
                                id: 'a1',
                                startTime: 0,
                                duration: 20,
                                uri: 'ad1.m3u8',
                            },
                            {
                                id: 'a2',
                                startTime: 0,
                                duration: 20,
                                uri: 'ad2.m3u8',
                            },
                        ],
                    })
                )
            )
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {}) // timeStart = 0
            updateTime(4) // under the limit and under a1.duration → keep playing
            expect(c.currentAd?.id).toBe('a1')
            updateTime(8) // cumulative 8 >= playoutLimit 8 → end break
            expect(c.currentAdBreak).toBeNull()
            // Absent offset → resume at start + capped playout (8).
            expect(resumes.at(-1)).toBe(8)
        })
    })

    describe('CUE=ONCE and replay', () => {
        it('replays a non-ONCE break after the playhead seeks back before it', async () => {
            const c = createController()
            c.setAds(trackAds(makeBreak({ startTime: 10, duration: 6 })))
            updateTime(11)
            await flush()
            expect(c.currentAd?.id).toBe('a1')
            c.skipAd() // completes → "spent"
            expect(c.currentAdBreak).toBeNull()
            playbackController.dispatch('emptied', {}) // ad→content swap clears the gate
            seekTo(5) // seek back before start → re-arm
            await flush()
            updateTime(11) // forward crossing → re-enter
            await flush()
            expect(c.currentAdBreak?.id).toBe('b1')
        })

        it('does not replay a ONCE break after a seek back', async () => {
            const c = createController()
            c.setAds(
                trackAds(makeBreak({ startTime: 10, duration: 6, once: true }))
            )
            updateTime(11)
            await flush()
            c.skipAd()
            playbackController.dispatch('emptied', {}) // ad→content swap clears the gate
            seekTo(5)
            await flush()
            updateTime(11)
            await flush()
            expect(c.currentAdBreak).toBeNull()
        })

        it('does not replay a spent break on a non-user seek settle', async () => {
            const c = createController()
            c.setAds(trackAds(makeBreak({ startTime: 10, duration: 6 })))
            updateTime(11)
            await flush()
            c.skipAd() // spent
            playbackController.dispatch('emptied', {}) // ad→content swap clears the gate
            // The ad→content source swap fires a 'seeked' with reason 'emptied'
            // while the MediaSource re-inits and transiently reports time 0.
            // This must NOT re-arm the break (only a real user seek does).
            playbackController.currentTime = 0
            playbackController.dispatch('seeked', {
                started: 0,
                ended: 0,
                duration: 0,
                reason: 'emptied',
            })
            await flush()
            updateTime(11) // forward crossing again
            await flush()
            expect(c.currentAdBreak).toBeNull()
        })

        it('does not replay a non-ONCE break when a seek stays at or after its start', async () => {
            const c = createController()
            c.setAds(trackAds(makeBreak({ startTime: 10, duration: 6 })))
            updateTime(11)
            await flush()
            c.skipAd()
            playbackController.dispatch('emptied', {}) // ad→content swap clears the gate
            seekTo(12) // seek, but not before start → not re-armed
            await flush()
            updateTime(13) // forward: still suppressed
            await flush()
            expect(c.currentAdBreak).toBeNull()
        })

        it('permanently suppresses a completed preroll within the presentation', async () => {
            const c = createController()
            c.setAds(
                trackAds(
                    makeBreak({ id: 'pre', startTime: 0, placement: 'preroll' })
                )
            )
            await flush()
            expect(c.currentAd?.id).toBe('a1')
            c.skipAd() // completes preroll → permanent suppression
            expect(c.currentAdBreak).toBeNull()
            // A live manifest refresh re-sets the same ads; the preroll must not
            // replay within the same presentation.
            c.setAds(
                trackAds(
                    makeBreak({ id: 'pre', startTime: 0, placement: 'preroll' })
                )
            )
            await flush()
            expect(c.currentAdBreak).toBeNull()
        })

        it('suppresses a completed postroll so enterPostroll does not replay it', async () => {
            const c = createController()
            const entered: string[] = []
            c.on('currentAdBreakChange', (e) => {
                if (e.current) entered.push(e.current.id)
            })
            c.setAds(
                trackAds(
                    makeBreak({
                        id: 'post',
                        startTime: 60,
                        duration: 10,
                        placement: 'postroll',
                    })
                )
            )
            // Content ends: the postroll activates and its single ad plays out.
            c.enterPostroll()
            await flush()
            expect(c.currentAd?.id).toBe('a1')
            playbackController.dispatch('ended', {
                previous: false,
                current: true,
            })
            expect(c.currentAdBreak).toBeNull()
            // A re-fired content `ended` calls enterPostroll again; the
            // already-played postroll must not replay.
            c.enterPostroll()
            await flush()
            expect(c.currentAdBreak)
                .withContext('postroll must not replay')
                .toBeNull()
            expect(c.currentAd).toBeNull()
            expect(entered).toEqual(['post'])
        })
    })

    describe('adTimeUpdate', () => {
        interface AdTiming {
            adCurrentTime: number
            adTimeRemaining: number | null
            breakCurrentTime: number
            breakTimeRemaining: number | null
        }
        function timingsOf(c: AdControllerImpl): AdTiming[] {
            const seen: AdTiming[] = []
            c.on('adTimeUpdate', (e) =>
                seen.push({
                    adCurrentTime: e.adCurrentTime,
                    adTimeRemaining: e.adTimeRemaining,
                    breakCurrentTime: e.breakCurrentTime,
                    breakTimeRemaining: e.breakTimeRemaining,
                })
            )
            return seen
        }

        it('reports elapsed and remaining time for the ad and the break', async () => {
            const c = createController()
            const seen = timingsOf(c)
            c.setAds(
                trackAds(
                    makeBreak({
                        startTime: 0,
                        duration: 30,
                        playoutLimit: 20,
                        ads: [
                            {
                                id: 'a1',
                                startTime: 0,
                                duration: 10,
                                uri: 'ad.m3u8',
                            },
                        ],
                    })
                )
            )
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {}) // timeStart = 0
            updateTime(4)
            const last = seen.at(-1)!
            expect(last.adCurrentTime).toBe(4)
            expect(last.adTimeRemaining).toBe(6) // ad.duration 10 - 4
            expect(last.breakCurrentTime).toBe(4)
            expect(last.breakTimeRemaining).toBe(16) // playoutLimit 20 - 4
        })

        it('falls back to the media duration when the ad duration is unknown', async () => {
            const c = createController()
            const seen = timingsOf(c)
            playbackController.duration = 12
            c.setAds(
                trackAds(
                    makeBreak({
                        startTime: 0,
                        duration: 12,
                        ads: [
                            {
                                id: 'a1',
                                startTime: 0,
                                duration: null,
                                uri: 'ad.m3u8',
                            },
                        ],
                    })
                )
            )
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {})
            updateTime(5)
            const last = seen.at(-1)!
            expect(last.adTimeRemaining).toBe(7) // media duration 12 - 5
            expect(last.breakTimeRemaining).toBe(7) // break duration 12 - 5
        })

        it('reports null remaining when the ad and break durations are unknown', async () => {
            const c = createController()
            const seen = timingsOf(c)
            playbackController.duration = Infinity
            c.setAds(
                trackAds(
                    makeBreak({
                        startTime: 0,
                        duration: null,
                        playoutLimit: null,
                        ads: [
                            {
                                id: 'a1',
                                startTime: 0,
                                duration: null,
                                uri: 'ad.m3u8',
                            },
                        ],
                    })
                )
            )
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {})
            updateTime(3)
            const last = seen.at(-1)!
            expect(last.adCurrentTime).toBe(3)
            expect(last.adTimeRemaining).toBeNull()
            expect(last.breakTimeRemaining).toBeNull()
        })
    })

    describe('skip window', () => {
        interface SkipState {
            canSkip: boolean
            skipIn: number | null
        }
        function skipStatesOf(c: AdControllerImpl): SkipState[] {
            const seen: SkipState[] = []
            c.on('adTimeUpdate', (e) =>
                seen.push({ canSkip: e.canSkip, skipIn: e.skipIn })
            )
            return seen
        }

        /** A break whose (async) skip window opens `offset`s in for `duration`s. */
        function breakWithSkip(offset: number, duration: number | null) {
            return makeBreak({
                startTime: 0,
                duration: 60,
                ads: [{ id: 'a1', startTime: 0, duration: null, uri: 'ad' }],
                skipControl: () => Promise.resolve({ offset, duration }),
            })
        }

        it('is not skippable before the window and counts down to it', async () => {
            const c = createController()
            const seen = skipStatesOf(c)
            c.setAds(trackAds(breakWithSkip(6, null)))
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {}) // timeStart = 0
            updateTime(2)
            const last = seen.at(-1)!
            expect(last.canSkip).toBeFalse()
            expect(last.skipIn).toBe(4) // offset 6 - played 2
        })

        it('becomes skippable once inside the window', async () => {
            const c = createController()
            const seen = skipStatesOf(c)
            c.setAds(trackAds(breakWithSkip(6, 5)))
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {})
            updateTime(8) // within [6, 11)
            const last = seen.at(-1)!
            expect(last.canSkip).toBeTrue()
            expect(last.skipIn).toBeNull()
        })

        it('stays skippable for the rest of the break when the window is open-ended', async () => {
            const c = createController()
            const seen = skipStatesOf(c)
            c.setAds(trackAds(breakWithSkip(6, null)))
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {})
            updateTime(10) // past offset 6, no window end
            const last = seen.at(-1)!
            expect(last.canSkip).toBeTrue()
            expect(last.skipIn).toBeNull()
        })

        it('stops being skippable after the window closes', async () => {
            const c = createController()
            const seen = skipStatesOf(c)
            c.setAds(trackAds(breakWithSkip(6, 5)))
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {})
            updateTime(12) // past 6 + 5 = 11
            const last = seen.at(-1)!
            expect(last.canSkip).toBeFalse()
            expect(last.skipIn).toBeNull()
        })

        it('never allows skipping when the break restricts it', async () => {
            const c = createController()
            const seen = skipStatesOf(c)
            c.setAds(
                trackAds(
                    makeBreak({
                        startTime: 0,
                        duration: 60,
                        restrict: { skip: true },
                        ads: [
                            {
                                id: 'a1',
                                startTime: 0,
                                duration: null,
                                uri: 'ad',
                            },
                        ],
                    })
                )
            )
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {})
            updateTime(3)
            const last = seen.at(-1)!
            expect(last.canSkip).toBeFalse()
            expect(last.skipIn).toBeNull()
        })

        it('leaves the break with no skip window if the control fails to resolve', async () => {
            const c = createController()
            const seen = skipStatesOf(c)
            c.setAds(
                trackAds(
                    makeBreak({
                        startTime: 0,
                        duration: 60,
                        ads: [
                            {
                                id: 'a1',
                                startTime: 0,
                                duration: null,
                                uri: 'ad',
                            },
                        ],
                        skipControl: () => Promise.reject(new Error('boom')),
                    })
                )
            )
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {})
            updateTime(3)
            const last = seen.at(-1)!
            // No resolved window → freely skippable.
            expect(last.canSkip).toBeTrue()
            expect(last.skipIn).toBeNull()
        })
    })

    describe('disposal during pending async work', () => {
        it('ignores a break ad list that resolves after disposal', async () => {
            const c = createController()
            let resolveAds: (ads: readonly AdInfo[]) => void = () => {}
            c.setAds(
                trackAds(
                    makeBreak({
                        startTime: 10,
                        ads: () =>
                            new Promise<readonly AdInfo[]>((resolve) => {
                                resolveAds = resolve
                            }),
                    })
                )
            )
            updateTime(10)
            c.dispose()
            resolveAds([defaultAd])
            await flush()
            expect(c.currentAd).toBeNull()
        })

        it('does not fail an ad after disposal when the load timeout elapses', async () => {
            // A small non-zero timeout so the timer is a real setTimeout that
            // fires after we dispose (sleep(0) would resolve on a microtask,
            // before dispose).
            const c = new AdControllerImpl(
                { playbackController },
                { adLoadTimeout: 0.001 }
            )
            const errors: unknown[] = []
            c.on('adError', (e) => errors.push(e.error))
            c.setAds(trackAds(makeBreak({ startTime: 0, duration: 10 })))
            updateTime(1)
            await flush()
            // Dispose before the load-timeout timer fires.
            c.dispose()
            await new Promise((resolve) => setTimeout(resolve, 5))
            expect(errors).toEqual([])
        })
    })

    describe('dispose', () => {
        it('stops responding to time updates', async () => {
            const c = createController()
            c.setAds(trackAds(makeBreak({ startTime: 10, duration: 5 })))
            c.dispose()
            const spy = jasmine.createSpy('currentAdBreakChange')
            c.on('currentAdBreakChange', spy)
            updateTime(11)
            await flush()
            expect(spy).not.toHaveBeenCalled()
        })
    })
})
