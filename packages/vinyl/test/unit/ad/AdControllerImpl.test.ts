/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AdBreakInfo, AdInfo, TrackAds } from '@amazon/vinyl'
import { AdControllerImpl } from '@amazon/vinyl'
import { MockPlaybackController, MockTrack } from '@amazon/vinyl/vinylTestUtil'
import type { MaybePromise } from '@amazon/vinyl-util'

describe('AdControllerImpl', () => {
    let playbackController: MockPlaybackController
    let controllers: AdControllerImpl[]

    beforeEach(() => {
        playbackController = new MockPlaybackController()
        controllers = []
    })

    // Dispose every controller a spec created. An activated-but-unstarted ad
    // arms a `sleep(adLoadTimeout)` timer.
    afterEach(() => {
        for (const c of controllers) if (!c.disposed) c.dispose()
    })

    function createController() {
        const c = new AdControllerImpl({ playbackController })
        controllers.push(c)
        return c
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
            resolutionTimeOffset: null,
            skipControl: () => null,
            ads: adsResolver,
            ...rest,
        }
    }

    /** Wraps ad breaks in the TrackAds shape a track's getAds() resolves. */
    function trackAds(...adBreaks: readonly AdBreakInfo[]): TrackAds {
        return { trackUri: 't1', adBreaks }
    }

    /**
     * Drains the pending microtask queue so multi-hop ad resolution settles
     * (setAdsProvider → getAds → setTrackAds, then nextAdOrBreak → nextAd →
     * getAds → startAd, and any follow-on break/ad advance). Uses microtask
     * rounds rather than a macrotask so it never fires the ad-load-timeout
     * timer.
     */
    async function flush(): Promise<void> {
        for (let i = 0; i < 12; i++) await Promise.resolve()
    }

    /**
     * Activates a content parent track whose `getAds()` resolves the given ads
     * and marks playback as playing — the state `onTimeUpdate` requires before
     * it will scan for midroll ingress. Returns the mock track so a test can
     * dispatch `adsChange` (via {@link refreshAds}) for a live manifest update.
     */
    async function setContent(
        c: AdControllerImpl,
        ads: TrackAds
    ): Promise<MockTrack> {
        const track = new MockTrack()
        track.uri = ads.trackUri
        track.active = true
        track.ads = ads
        playbackController.playing = true
        c.setAdsProvider(track)
        await flush() // let setAdsProvider's getAds() resolve → setTrackAds
        return track
    }

    /**
     * Simulates a live manifest refresh on the SAME content track: swaps the
     * ads and fires `adsChange`, which the controller re-reads via getAds().
     * Unlike a new {@link setContent}, this preserves completed/spent break
     * suppression (no content change).
     */
    async function refreshAds(track: MockTrack, ads: TrackAds): Promise<void> {
        track.ads = ads
        track.dispatch('adsChange', {})
        await flush()
    }

    it('starts with no ads and no active break', () => {
        const c = createController()
        expect(c.currentTrackAds).toBeNull()
        expect(c.currentAdBreak).toBeNull()
        expect(c.currentAd).toBeNull()
    })

    describe('adPreload', () => {
        // Default preloadAheadTime is 10s.
        it('emits adPreload as the playhead approaches a midroll', async () => {
            const c = createController()
            await setContent(
                c,
                trackAds(makeBreak({ id: 'm', startTime: 30, duration: 5 }))
            )
            const preloaded: string[] = []
            c.on('adPreload', (e) => preloaded.push(e.adBreak.id))
            updateTime(19) // outside the 10s window [20, 30)
            await flush()
            expect(preloaded).toEqual([])
            updateTime(21) // inside the window
            await flush()
            expect(preloaded).toEqual(['m'])
        })

        it('emits adPreload only once while approaching', async () => {
            const c = createController()
            await setContent(
                c,
                trackAds(makeBreak({ id: 'm', startTime: 30, duration: 5 }))
            )
            const preloaded: string[] = []
            c.on('adPreload', (e) => preloaded.push(e.adBreak.id))
            updateTime(21)
            updateTime(22)
            updateTime(23)
            await flush()
            expect(preloaded).toEqual(['m'])
        })

        it('does not emit adPreload for a preroll', async () => {
            const c = createController()
            await setContent(
                c,
                trackAds(
                    makeBreak({ id: 'pre', startTime: 0, placement: 'preroll' })
                )
            )
            const preloaded: string[] = []
            c.on('adPreload', (e) => preloaded.push(e.adBreak.id))
            updateTime(1)
            await flush()
            expect(preloaded).toEqual([])
        })

        it('emits adPreload as the playhead approaches a postroll', async () => {
            const c = createController()
            await setContent(
                c,
                trackAds(
                    makeBreak({
                        id: 'post',
                        startTime: 60,
                        duration: 5,
                        placement: 'postroll',
                    })
                )
            )
            const preloaded: string[] = []
            c.on('adPreload', (e) => preloaded.push(e.adBreak.id))
            updateTime(49) // outside [50, 60)
            await flush()
            expect(preloaded).toEqual([])
            updateTime(51)
            await flush()
            expect(preloaded).toEqual(['post'])
        })

        it("uses the break's resolutionTimeOffset over the preloadAheadTime option", async () => {
            const c = createController()
            await setContent(
                c,
                trackAds(
                    makeBreak({
                        id: 'm',
                        startTime: 30,
                        duration: 5,
                        resolutionTimeOffset: 5,
                    })
                )
            )
            const preloaded: string[] = []
            c.on('adPreload', (e) => preloaded.push(e.adBreak.id))
            updateTime(21) // inside the default 10s window but outside the 5s offset
            await flush()
            expect(preloaded).toEqual([])
            updateTime(26) // inside the 5s window [25, 30)
            await flush()
            expect(preloaded).toEqual(['m'])
        })

        it('honors a custom preloadAheadTime option', async () => {
            const c = new AdControllerImpl(
                { playbackController },
                { preloadAheadTime: 3 }
            )
            await setContent(
                c,
                trackAds(makeBreak({ id: 'm', startTime: 30, duration: 5 }))
            )
            const preloaded: string[] = []
            c.on('adPreload', (e) => preloaded.push(e.adBreak.id))
            updateTime(26) // outside the 3s window [27, 30)
            await flush()
            expect(preloaded).toEqual([])
            updateTime(28)
            await flush()
            expect(preloaded).toEqual(['m'])
        })

        it('does not emit adPreload for a played-once (suppressed) break', async () => {
            const c = createController()
            await setContent(
                c,
                trackAds(
                    makeBreak({
                        id: 'm',
                        startTime: 30,
                        duration: 5,
                        once: true,
                    })
                )
            )
            updateTime(30) // enter the break
            await flush()
            c.skipAd() // -> completed, suppressed for the presentation
            await flush()
            const preloaded: string[] = []
            c.on('adPreload', (e) => preloaded.push(e.adBreak.id))
            seekTo(15) // seek back and approach again
            updateTime(22)
            await flush()
            expect(preloaded).toEqual([])
        })

        it('re-arms the preload signal for a replayable break after a seek back', async () => {
            const c = createController()
            await setContent(
                c,
                trackAds(makeBreak({ id: 'm', startTime: 30, duration: 5 }))
            )
            const preloaded: string[] = []
            c.on('adPreload', (e) => preloaded.push(e.adBreak.id))
            updateTime(22) // approach -> preload #1
            await flush()
            expect(preloaded).toEqual(['m'])
            seekTo(10) // seek back re-arms the preload signal
            updateTime(23) // approach again -> preload #2
            await flush()
            expect(preloaded).toEqual(['m', 'm'])
        })
    })

    describe('ad discovery failures', () => {
        /** A parent track whose getAds() rejects (e.g. a manifest fetch error). */
        function rejectingTrack(): MockTrack {
            const track = new MockTrack()
            track.uri = 't1'
            track.active = true
            track.getAds = () => Promise.reject(new Error('discovery failed'))
            return track
        }

        it('logs and does not throw when parent-track ad discovery rejects', async () => {
            const c = createController()
            c.setAdsProvider(rejectingTrack())
            await flush()
            // The failure is swallowed (logged) — no ads, no active break, no throw.
            expect(c.currentTrackAds).toBeNull()
            expect(c.currentAdBreak).toBeNull()
        })

        it('ignores a rejected discovery after the parent track has changed', async () => {
            const c = createController()
            c.setAdsProvider(rejectingTrack())
            c.setAdsProvider(null) // interrupts the in-flight discovery
            await flush()
            expect(c.currentTrackAds).toBeNull()
        })

        it('resolves enterPreroll to null when ad discovery rejects', async () => {
            const c = createController()
            c.setAdsProvider(rejectingTrack())
            await flush()
            expect(await c.enterPreroll()).toBeNull()
        })
    })

    describe('defensive no-ops and disposal', () => {
        it('is a no-op when the same parent track is set again', async () => {
            const c = createController()
            const track = new MockTrack()
            track.uri = 't1'
            track.active = true
            track.ads = trackAds(makeBreak())
            c.setAdsProvider(track)
            await flush()
            let changes = 0
            c.on('currentTrackAdsChange', () => changes++)
            c.setAdsProvider(track) // same provider → early return, no re-read
            await flush()
            expect(changes).toBe(0)
        })

        it('resolves enterPreroll and enterPostroll to null with no parent track', async () => {
            const c = createController()
            expect(await c.enterPreroll()).toBeNull()
            expect(await c.enterPostroll()).toBeNull()
        })

        it('does not scan midrolls when there is no active content track', async () => {
            const c = createController()
            playbackController.playing = true
            updateTime(15) // contentTrackActive is false (no parent track)
            await flush()
            expect(c.currentAdBreak).toBeNull()
        })

        it('ignores a late ad-list rejection after dispose', async () => {
            const c = createController()
            let rejectAds: (e: Error) => void = () => {}
            const track = new MockTrack()
            track.uri = 't1'
            track.active = true
            track.ads = trackAds(
                makeBreak({
                    startTime: 0,
                    duration: 5,
                    ads: () =>
                        new Promise<readonly AdInfo[]>((_res, rej) => {
                            rejectAds = rej
                        }),
                })
            )
            c.setAdsProvider(track)
            playbackController.playing = true
            await flush() // getAds resolves → midroll registered
            updateTime(1) // enters the break; nextAd awaits the ad list
            await flush()
            c.dispose()
            rejectAds(new Error('late')) // nextAd catch: `if (this.disposed) return`
            await flush()
            expect(c.currentAdBreak).toBeNull()
        })
    })

    it('emits currentTrackAdsChange with the TrackAds when a parent track is set', async () => {
        const c = createController()
        const events: (TrackAds | null)[] = []
        c.on('currentTrackAdsChange', (e) => events.push(e.current))
        await setContent(c, trackAds(makeBreak()))
        expect(events.at(-1)?.adBreaks.map((b) => b.id)).toEqual(['b1'])
        expect(c.currentTrackAds?.adBreaks.map((b) => b.id)).toEqual(['b1'])
    })

    it('clears the ads when the parent track is cleared', async () => {
        const c = createController()
        await setContent(c, trackAds(makeBreak()))
        c.setAdsProvider(null)
        expect(c.currentTrackAds).toBeNull()
    })

    describe('midroll entry', () => {
        it('activates a break when the playhead crosses its start time', async () => {
            const c = createController()
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 10, duration: 5 }))
            )
            const entered: (string | null)[] = []
            c.on('adBreakEntered', (e) => entered.push(e.adBreak.id))

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
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 10, duration: 10 }))
            )
            let changes = 0
            c.on('adBreakEntered', () => changes++)
            updateTime(11)
            await flush()
            updateTime(12)
            updateTime(13)
            await flush()
            expect(changes).toBe(1)
        })

        it('treats a null-duration break as open-ended (still enters)', async () => {
            const c = createController()
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 10, duration: null }))
            )
            updateTime(11)
            await flush()
            expect(c.currentAdBreak?.id).toBe('b1')
        })

        it('enters tied breaks that share a start time', async () => {
            // Regression: checkMidrollIngress previously examined only the
            // single nearest preceding break, silently dropping a break tied on
            // startTime.
            const c = createController()
            const entered: string[] = []
            c.on('adBreakEntered', (e) => entered.push(e.adBreak.id))
            await setContent(
                c,
                trackAds(
                    makeBreak({ id: 'A', startTime: 10, duration: 5 }),
                    makeBreak({ id: 'B', startTime: 10, duration: 5 })
                )
            )
            updateTime(10)
            await flush()
            // Both tied breaks enter (A first, then B after A completes).
            expect(entered).toContain('A')
            c.skipAdBreak()
            await flush()
            expect(entered).toEqual(['A', 'B'])
        })

        it('enters an earlier still-open break after seeking into it', async () => {
            // Regression: a long break started earlier that contains the
            // playhead must be entered even when a shorter later break was
            // already passed by the seek.
            const c = createController()
            const entered: string[] = []
            c.on('adBreakEntered', (e) => entered.push(e.adBreak.id))
            await setContent(
                c,
                trackAds(
                    makeBreak({ id: 'long', startTime: 10, duration: 100 }),
                    makeBreak({ id: 'short', startTime: 50, duration: 5 })
                )
            )
            // Seek to 60: inside `long` (10–110); `short` (50–55) already ended.
            updateTime(60)
            await flush()
            expect(entered).toEqual(['long'])
            expect(c.currentAdBreak?.id).toBe('long')
        })
    })

    describe('preroll', () => {
        it('enters when enterPreroll is called', async () => {
            const c = createController()
            await setContent(
                c,
                trackAds(
                    makeBreak({ id: 'pre', startTime: 0, placement: 'preroll' })
                )
            )
            // Prerolls are not entered by setting ads or crossing a range; the
            // track controller enters them via enterPreroll.
            expect(c.currentAdBreak).toBeNull()
            await c.enterPreroll()
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
            await setContent(c, trackAds(multiAdBreak()))
            updateTime(1)
            await flush()
            expect(c.currentAd?.id).toBe('a1')
            c.skipAd()
            await flush()
            expect(c.currentAd?.id).toBe('a2')
            expect(c.currentAdBreak?.id).toBe('b1')
        })

        it('ends the break after skipping the last ad', async () => {
            const c = createController()
            await setContent(c, trackAds(multiAdBreak()))
            updateTime(1)
            await flush()
            c.skipAd() // to a2
            await flush()
            const changes: (string | null)[] = []
            c.on('adBreakEntered', (e) => changes.push(e.adBreak.id))
            c.on('adBreakCompleted', () => changes.push(null))
            c.skipAd() // past last -> break ends
            await flush()
            expect(changes).toEqual([null])
            expect(c.currentAdBreak).toBeNull()
        })

        it('is a no-op when no ad is active', async () => {
            const c = createController()
            await setContent(c, trackAds(makeBreak()))
            const spy = jasmine.createSpy('adBreakChange')
            c.on('adBreakEntered', spy)
            c.on('adBreakCompleted', spy)
            c.skipAd()
            expect(spy).not.toHaveBeenCalled()
        })

        it('prevents re-entry into a skipped single-ad break', async () => {
            const c = createController()
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 0, duration: 10 }))
            )
            updateTime(5)
            await flush()
            c.skipAd()
            const spy = jasmine.createSpy('adBreakChange')
            c.on('adBreakEntered', spy)
            c.on('adBreakCompleted', spy)
            updateTime(7)
            await flush()
            expect(spy).not.toHaveBeenCalled()
            expect(c.currentAdBreak).toBeNull()
        })
    })

    describe('skipAdBreak', () => {
        it('is a no-op when no break is active', () => {
            const c = createController()
            const spy = jasmine.createSpy('adBreakChange')
            c.on('adBreakEntered', spy)
            c.on('adBreakCompleted', spy)
            c.skipAdBreak()
            expect(spy).not.toHaveBeenCalled()
        })

        it('skips the entire active break', async () => {
            const c = createController()
            await setContent(
                c,
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
            c.on('adBreakEntered', (e) => events.push(e.adBreak.id))
            c.on('adBreakCompleted', () => events.push(null))
            c.skipAdBreak()
            await flush()
            expect(events).toEqual([null])
            expect(c.currentAdBreak).toBeNull()
            // Not re-entered by a later time update within its range.
            updateTime(5)
            await flush()
            expect(c.currentAdBreak).toBeNull()
        })
    })

    describe('a break with no ads', () => {
        it('completes immediately with a resume position and plays no ad', async () => {
            const c = createController()
            const entered: string[] = []
            const completed: { id: string; resumePosition: number }[] = []
            c.on('adBreakEntered', (e) => entered.push(e.adBreak.id))
            c.on('adBreakCompleted', (e) =>
                completed.push({
                    id: e.adBreak.id,
                    resumePosition: e.resumePosition,
                })
            )
            await setContent(
                c,
                trackAds(
                    makeBreak({
                        id: 'mid',
                        startTime: 10,
                        duration: 5,
                        resumeOffset: 2,
                        ads: [],
                    })
                )
            )
            updateTime(10)
            await flush()
            // The break was entered and immediately completed (resume =
            // startTime + offset), and no ad ever played.
            expect(entered).toEqual(['mid'])
            expect(completed).toEqual([{ id: 'mid', resumePosition: 12 }])
            expect(c.currentAd).toBeNull()
            expect(c.currentAdBreak).toBeNull()
        })

        it('advances to the next break rather than trapping the playhead', async () => {
            const c = createController()
            const entered: string[] = []
            c.on('adBreakEntered', (e) => entered.push(e.adBreak.id))
            await setContent(
                c,
                trackAds(
                    makeBreak({ id: 'pre1', placement: 'preroll', ads: [] }),
                    makeBreak({ id: 'pre2', placement: 'preroll' })
                )
            )
            await c.enterPreroll()
            await flush()
            // The empty first preroll completes and the second is entered.
            expect(entered).toEqual(['pre1', 'pre2'])
            expect(c.currentAdBreak?.id).toBe('pre2')
        })
    })

    describe('clearCompletedAds', () => {
        it('allows a previously skipped break to be entered again', async () => {
            const c = createController()
            const track = await setContent(
                c,
                trackAds(makeBreak({ startTime: 0, duration: 10 }))
            )
            updateTime(5)
            await flush()
            c.skipAd()
            expect(c.currentAdBreak).toBeNull()

            // A content change clears completed-ad suppression. Re-set the same
            // ads on a fresh content track so the break can be entered again.
            await setContent(c, track.ads!)
            updateTime(6)
            await flush()
            expect(c.currentAdBreak?.id).toBe('b1')
        })
    })

    describe('empty / failing ad lists', () => {
        it('completes a break whose resolver returns no ads', async () => {
            const c = createController()
            await setContent(
                c,
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
            const completedReasons: string[] = []
            c.on('adError', (e) => errors.push(e.error))
            c.on('adBreakCompleted', (e) => completedReasons.push(e.reason))
            await setContent(
                c,
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
            // The break must complete (reason 'error') so content can resume —
            // it must not stall non-null.
            expect(completedReasons).toEqual(['error'])
            expect(c.currentAdBreak).toBeNull()
        })

        it('recovers: a later midroll still enters after an ad-list rejection', async () => {
            // Regression for the session-fatal hang — a transient ad-list fetch
            // failure previously left currentAdBreak stuck non-null, killing all
            // subsequent midroll ingress.
            const c = createController()
            const entered: string[] = []
            c.on('adBreakEntered', (e) => entered.push(e.adBreak.id))
            await setContent(
                c,
                trackAds(
                    makeBreak({
                        id: 'bad',
                        startTime: 10,
                        duration: 5,
                        ads: () => Promise.reject(new Error('fetch failed')),
                    }),
                    makeBreak({ id: 'good', startTime: 20, duration: 5 })
                )
            )
            updateTime(10)
            await flush()
            expect(c.currentAdBreak).toBeNull() // 'bad' failed and completed
            updateTime(20)
            await flush()
            expect(c.currentAdBreak?.id).toBe('good')
            expect(entered).toEqual(['bad', 'good'])
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
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 0, duration: 10 }))
            )
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
            await setContent(
                c,
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

            await c.enterPostroll()
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
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 0, duration: 10 }))
            )
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
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 0, duration: 10 }))
            )
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
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 0, duration: 10 }))
            )
            updateTime(0)
            await flush()
            // Ad begins playing at time 0.
            playbackController.dispatch('playing', {})
            playbackController.duration = 10
            playbackController.playbackRate = 1
            playbackController.currentTimePercent = 0.3
            updateTime(3)
            await flush()
            expect(quartiles).toEqual(['a1'])
        })

        it('dispatches adMidpoint after 50% of the ad has played', async () => {
            const c = createController()
            const midpoints: number[] = []
            c.on('adMidpoint', (e) => midpoints.push(e.playbackRateAvg))
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 0, duration: 10 }))
            )
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {})
            playbackController.duration = 10
            playbackController.playbackRate = 1
            playbackController.currentTimePercent = 0.6
            updateTime(6)
            await flush()
            expect(midpoints.length).toBe(1)
        })

        it('dispatches adThirdQuartile after 75% of the ad has played', async () => {
            const c = createController()
            const thirds: string[] = []
            c.on('adThirdQuartile', (e) => thirds.push(e.ad.id))
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 0, duration: 10 }))
            )
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {})
            playbackController.duration = 10
            playbackController.playbackRate = 1
            playbackController.currentTimePercent = 0.8
            updateTime(8)
            await flush()
            expect(thirds).toEqual(['a1'])
        })

        it('does not emit quartiles or throw when the ad duration is zero', async () => {
            // Regression: a zero reported duration must not divide-by-zero into
            // NaN progress and must not emit bogus quartile events.
            const c = createController()
            const events: string[] = []
            c.on('adFirstQuartile', () => events.push('first'))
            c.on('adMidpoint', () => events.push('mid'))
            c.on('adThirdQuartile', () => events.push('third'))
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 0, duration: 10 }))
            )
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {})
            playbackController.duration = 0
            playbackController.currentTimePercent = 0.9
            expect(() => updateTime(1)).not.toThrow()
            await flush()
            expect(events).toEqual([])
        })

        it('fails the ad if it does not start within the load timeout', async () => {
            const c = new AdControllerImpl(
                { playbackController },
                { adLoadTimeout: 0 }
            )
            const errors: unknown[] = []
            c.on('adError', (e) => errors.push(e.error))
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 0, duration: 10 }))
            )
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
        it('tears down an active ad when the content track changes', async () => {
            const c = createController()
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 0, duration: 10 }))
            )
            updateTime(1)
            await flush()
            expect(c.currentAd?.id).toBe('a1')
            const entered: string[] = []
            const completedReasons: string[] = []
            c.on('adBreakEntered', (e) => entered.push(e.adBreak.id))
            c.on('adBreakCompleted', (e) => completedReasons.push(e.reason))
            // A content change to a different track tears down the in-flight ad
            // so it cannot leak into the new presentation; the break completes
            // with reason 'contentChange' and no new break is entered.
            await setContent(c, { trackUri: 't2', adBreaks: [] })
            expect(c.currentAd).toBeNull()
            expect(c.currentAdBreak).toBeNull()
            expect(entered).toEqual([])
            expect(completedReasons).toEqual(['contentChange'])
        })

        it('does not emit a stray adEntered when the content swaps mid-resolve', async () => {
            // Regression: an ad whose list was still resolving when the parent
            // track changed must not fire adEntered for the abandoned break.
            const c = createController()
            let resolveAds: (ads: readonly AdInfo[]) => void = () => {}
            const enteredAds: string[] = []
            c.on('adEntered', (e) => enteredAds.push(e.ad.id))
            await setContent(
                c,
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
            updateTime(10) // enter the break; its ads are still resolving
            await flush()
            // Content changes before the ad list resolves.
            await setContent(c, { trackUri: 't2', adBreaks: [] })
            resolveAds([defaultAd])
            await flush()
            expect(enteredAds).toEqual([])
            expect(c.currentAd).toBeNull()
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
            const track = await setContent(
                c,
                trackAds(makeBreak({ startTime: 0, duration: 10 }))
            )
            updateTime(1)
            await flush()
            expect(c.currentAd?.id).toBe('a1')

            // A live manifest update arrives mid-ad; the active ad must not be
            // interrupted by newly discovered breaks.
            await refreshAds(
                track,
                trackAds(
                    makeBreak({ id: 'pre', startTime: 0, placement: 'preroll' })
                )
            )
            expect(c.currentAd?.id).toBe('a1')
        })

        it('enters the nearest preceding midroll on a forward crossing', async () => {
            const c = createController()
            await setContent(
                c,
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
            c.on('adBreakCompleted', (e) => resumes.push(e.resumePosition))
            return resumes
        }

        it('resumes at the scheduled start plus a present offset', async () => {
            const c = createController()
            const resumes = resumesOf(c)
            await setContent(
                c,
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
            await setContent(
                c,
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
            await setContent(
                c,
                trackAds(
                    makeBreak({ startTime: 10, duration: 6, resumeOffset: -4 })
                )
            )
            updateTime(10)
            await flush()
            c.skipAd()
            expect(resumes.at(-1)).toBe(10)
        })

        it('resumes at the cue point regardless of how long the ad played', async () => {
            const c = createController()
            const resumes = resumesOf(c)
            await setContent(
                c,
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
            updateTime(16) // the ad plays 6s on its own track
            playbackController.dispatch('ended', {
                previous: false,
                current: true,
            })
            // The content timeline did not advance during the ad, so with no
            // explicit offset content resumes at the cue point, not startTime +
            // the 6s of ad playout.
            expect(resumes.at(-1)).toBe(10)
        })

        it('resumes at the cue point even after a seek within the ad', async () => {
            const c = createController()
            const resumes: number[] = []
            c.on('adBreakCompleted', (e) => resumes.push(e.resumePosition))
            await setContent(
                c,
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
            seekTo(14) // seek within the ad (re-baselines its playout accounting)
            updateTime(18)
            playbackController.dispatch('ended', {
                previous: false,
                current: true,
            })
            // Ad-track playout — however it is measured — does not move the
            // content resume: with no explicit offset it stays at the cue point.
            expect(resumes.at(-1)).toBe(10)
        })

        it('parks a postroll resume at the content end, not past it', async () => {
            const c = createController()
            const resumes: number[] = []
            c.on('adBreakCompleted', (e) => resumes.push(e.resumePosition))
            playbackController.duration = 100
            await setContent(
                c,
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
            await c.enterPostroll()
            await flush()
            playbackController.dispatch('playing', {}) // timeStart = 0
            playbackController.currentTime = 8 // ad played 8s
            playbackController.dispatch('ended', {
                previous: false,
                current: true,
            })
            // A postroll's cue point is the content end and it carries no
            // offset, so the resume parks at the content end (100).
            expect(resumes.at(-1)).toBe(100)
        })

        it('preserves a forward seek into the break over the offset', async () => {
            const c = createController()
            const resumes = resumesOf(c)
            await setContent(
                c,
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
            await setContent(
                c,
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
            await flush()
            expect(c.currentAd?.id).toBe('a2')
        })

        it('ends the whole break when the playout limit is reached, dropping remaining ads', async () => {
            const c = createController()
            const resumes: number[] = []
            c.on('adBreakCompleted', (e) => resumes.push(e.resumePosition))
            await setContent(
                c,
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
            await flush()
            expect(c.currentAdBreak).toBeNull()
            // The playout limit ends the break, but with no explicit offset the
            // content still resumes at the cue point (0), not startTime + playout.
            expect(resumes.at(-1)).toBe(0)
        })
    })

    describe('CUE=ONCE and replay', () => {
        it('replays a non-ONCE break after the playhead seeks back before it', async () => {
            const c = createController()
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 10, duration: 6 }))
            )
            updateTime(11)
            await flush()
            expect(c.currentAd?.id).toBe('a1')
            c.skipAd() // completes → "spent"
            expect(c.currentAdBreak).toBeNull()
            seekTo(5) // seek back before start → re-arm
            await flush()
            updateTime(11) // forward crossing → re-enter
            await flush()
            expect(c.currentAdBreak?.id).toBe('b1')
        })

        it('does not replay a ONCE break after a seek back', async () => {
            const c = createController()
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 10, duration: 6, once: true }))
            )
            updateTime(11)
            await flush()
            c.skipAd()
            seekTo(5)
            await flush()
            updateTime(11)
            await flush()
            expect(c.currentAdBreak).toBeNull()
        })

        it('does not replay a spent break on a non-user seek settle', async () => {
            const c = createController()
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 10, duration: 6 }))
            )
            updateTime(11)
            await flush()
            c.skipAd() // spent
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
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 10, duration: 6 }))
            )
            updateTime(11)
            await flush()
            c.skipAd()
            seekTo(12) // seek, but not before start → not re-armed
            await flush()
            updateTime(13) // forward: still suppressed
            await flush()
            expect(c.currentAdBreak).toBeNull()
        })

        it('permanently suppresses a completed preroll within the presentation', async () => {
            const c = createController()
            const track = await setContent(
                c,
                trackAds(
                    makeBreak({ id: 'pre', startTime: 0, placement: 'preroll' })
                )
            )
            await c.enterPreroll()
            expect(c.currentAd?.id).toBe('a1')
            c.skipAd() // completes preroll → permanent suppression
            expect(c.currentAdBreak).toBeNull()
            // A live manifest refresh re-sets the same ads on the same track;
            // the preroll must not replay within the same presentation.
            await refreshAds(
                track,
                trackAds(
                    makeBreak({ id: 'pre', startTime: 0, placement: 'preroll' })
                )
            )
            await c.enterPreroll()
            expect(c.currentAdBreak).toBeNull()
        })

        it('suppresses a completed postroll so enterPostroll does not replay it', async () => {
            const c = createController()
            const entered: string[] = []
            c.on('adBreakEntered', (e) => {
                entered.push(e.adBreak.id)
            })
            await setContent(
                c,
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
            await c.enterPostroll()
            await flush()
            expect(c.currentAd?.id).toBe('a1')
            playbackController.dispatch('ended', {
                previous: false,
                current: true,
            })
            expect(c.currentAdBreak).toBeNull()
            // A re-fired content `ended` calls enterPostroll again; the
            // already-played postroll must not replay.
            await c.enterPostroll()
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
            await setContent(
                c,
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
            await flush()
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
            await setContent(
                c,
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
            await flush()
            const last = seen.at(-1)!
            expect(last.adTimeRemaining).toBe(7) // media duration 12 - 5
            expect(last.breakTimeRemaining).toBe(7) // break duration 12 - 5
        })

        it('reports null remaining when the ad and break durations are unknown', async () => {
            const c = createController()
            const seen = timingsOf(c)
            playbackController.duration = Infinity
            await setContent(
                c,
                trackAds(
                    makeBreak({
                        startTime: 0,
                        duration: null,
                        playoutLimit: null,
                        resolutionTimeOffset: null,
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
            await flush()
            const last = seen.at(-1)!
            expect(last.adCurrentTime).toBe(3)
            expect(last.adTimeRemaining).toBeNull()
            expect(last.breakTimeRemaining).toBeNull()
        })

        it('caps ad time remaining by the break playout limit', async () => {
            const c = createController()
            const seen = timingsOf(c)
            await setContent(
                c,
                trackAds(
                    makeBreak({
                        startTime: 0,
                        duration: 8,
                        playoutLimit: 8,
                        ads: [
                            {
                                id: 'a1',
                                startTime: 0,
                                // Natural duration exceeds the playout limit, so
                                // the ad is cut off at the limit and the reported
                                // total must reflect that (not the full 20s).
                                duration: 20,
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
            await flush()
            const last = seen.at(-1)!
            expect(last.adCurrentTime).toBe(4)
            expect(last.adTimeRemaining).toBe(4) // min(ad 20, limit 8) - 4
            expect(last.breakTimeRemaining).toBe(4) // playoutLimit 8 - 4
        })

        it('uses the playout-limit remainder when the ad duration is unknown', async () => {
            const c = createController()
            const seen = timingsOf(c)
            playbackController.duration = Infinity
            await setContent(
                c,
                trackAds(
                    makeBreak({
                        startTime: 0,
                        duration: 8,
                        playoutLimit: 8,
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
            await flush()
            const last = seen.at(-1)!
            // Without a known ad duration and with an infinite media duration,
            // the limit remainder bounds the report instead of leaving it null.
            expect(last.adTimeRemaining).toBe(5) // limit 8 - 3
            expect(last.breakTimeRemaining).toBe(5)
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
            await setContent(c, trackAds(breakWithSkip(6, null)))
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {}) // timeStart = 0
            updateTime(2)
            await flush()
            const last = seen.at(-1)!
            expect(last.canSkip).toBeFalse()
            expect(last.skipIn).toBe(4) // offset 6 - played 2
        })

        it('becomes skippable once inside the window', async () => {
            const c = createController()
            const seen = skipStatesOf(c)
            await setContent(c, trackAds(breakWithSkip(6, 5)))
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {})
            updateTime(8) // within [6, 11)
            await flush()
            const last = seen.at(-1)!
            expect(last.canSkip).toBeTrue()
            expect(last.skipIn).toBeNull()
        })

        it('stays skippable for the rest of the break when the window is open-ended', async () => {
            const c = createController()
            const seen = skipStatesOf(c)
            await setContent(c, trackAds(breakWithSkip(6, null)))
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {})
            updateTime(10) // past offset 6, no window end
            await flush()
            const last = seen.at(-1)!
            expect(last.canSkip).toBeTrue()
            expect(last.skipIn).toBeNull()
        })

        it('stops being skippable after the window closes', async () => {
            const c = createController()
            const seen = skipStatesOf(c)
            await setContent(c, trackAds(breakWithSkip(6, 5)))
            updateTime(0)
            await flush()
            playbackController.dispatch('playing', {})
            updateTime(12) // past 6 + 5 = 11
            await flush()
            const last = seen.at(-1)!
            expect(last.canSkip).toBeFalse()
            expect(last.skipIn).toBeNull()
        })

        it('never allows skipping when the break restricts it', async () => {
            const c = createController()
            const seen = skipStatesOf(c)
            await setContent(
                c,
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
            await flush()
            const last = seen.at(-1)!
            expect(last.canSkip).toBeFalse()
            expect(last.skipIn).toBeNull()
        })

        it('leaves the break with no skip window if the control fails to resolve', async () => {
            const c = createController()
            const seen = skipStatesOf(c)
            await setContent(
                c,
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
            await flush()
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
            const entered = jasmine.createSpy('adEntered')
            const playing = jasmine.createSpy('adPlaying')
            c.on('adEntered', entered)
            c.on('adPlaying', playing)
            await setContent(
                c,
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
            // The ad list resolves after disposal: the controller must not act
            // on it — no ad is entered or started.
            expect(entered).not.toHaveBeenCalled()
            expect(playing).not.toHaveBeenCalled()
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
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 0, duration: 10 }))
            )
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
            await setContent(
                c,
                trackAds(makeBreak({ startTime: 10, duration: 5 }))
            )
            c.dispose()
            const spy = jasmine.createSpy('adBreakChange')
            c.on('adBreakEntered', spy)
            c.on('adBreakCompleted', spy)
            updateTime(11)
            await flush()
            expect(spy).not.toHaveBeenCalled()
        })
    })
})
