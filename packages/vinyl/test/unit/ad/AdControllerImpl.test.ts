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
