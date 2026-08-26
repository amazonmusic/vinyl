/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    AdControllerImpl,
    createVinylPlayer,
    type AdBreakInfo,
    type TrackAds,
    type VinylDeps,
} from '@amazon/vinyl'
import { externalDependencies, type Factories } from '@amazon/vinyl-di'
import {
    createMockVinylDependencies,
    MockTrack,
} from '@amazon/vinyl/vinylTestUtil'
import { MockHTMLAudioElement } from '@amazon/vinyl-util/browserTestUtil'
import { createEventSpy } from '@amazon/vinyl-util/testUtil'

describe('VinylPlayer ad break API', () => {
    let adController: AdControllerImpl
    let base: ReturnType<typeof createMockVinylDependencies>
    let depFactories: Factories<VinylDeps>
    let player: ReturnType<typeof createVinylPlayer>

    beforeEach(() => {
        base = createMockVinylDependencies()
        // Use a real ad controller so setTrackAds drives state and events that the
        // player getters and redispatch reflect.
        adController = new AdControllerImpl({
            playbackController: base.playbackController,
        })
        depFactories = externalDependencies({ ...base, adController })
        player = createVinylPlayer(
            { media: new MockHTMLAudioElement() },
            depFactories
        )
    })

    afterEach(() => {
        player.dispose()
    })

    function makeBreak(overrides: Partial<AdBreakInfo> = {}): AdBreakInfo {
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
            ads: () =>
                Promise.resolve([
                    {
                        id: 'a1',
                        startTime: 10,
                        duration: 5,
                        uri: 'ad.m3u8',
                    },
                ]),
            ...overrides,
        }
    }

    function trackAds(...adBreaks: readonly AdBreakInfo[]): TrackAds {
        return { trackUri: 't1', adBreaks }
    }

    function simulateTimeUpdate(time: number) {
        base.playbackController.currentTime = time
        base.playbackController.dispatch('timeUpdate', {
            previous: 0,
            current: time,
        })
    }

    /** Waits for pending microtasks (ad resolution) to settle. */
    async function flush(): Promise<void> {
        await Promise.resolve()
        await Promise.resolve()
    }

    /**
     * Activates a content parent track whose getAds() resolves the given ads
     * and marks playback playing — the state the ad controller requires before
     * it scans for midroll ingress. Awaits the async ad resolution.
     */
    async function setContent(ads: TrackAds): Promise<void> {
        const track = new MockTrack()
        track.uri = ads.trackUri
        track.active = true
        track.ads = ads
        base.playbackController.playing = true
        adController.setAdsProvider(track)
        await flush()
    }

    it('returns empty defaults when no ad breaks are set', () => {
        expect(player.currentTrackAds).toBeNull()
        expect(player.currentAdBreak).toBeNull()
    })

    it('returns ad breaks from the player-level ad controller', async () => {
        await setContent(trackAds(makeBreak()))
        expect(player.currentTrackAds?.adBreaks.map((b) => b.id)).toEqual([
            'b1',
        ])
    })

    it('redispatches currentTrackAdsChange from the ad controller', async () => {
        const spy = createEventSpy(player, 'currentTrackAdsChange')
        await setContent(trackAds(makeBreak()))
        expect(spy).toHaveBeenCalled()
    })

    it('redispatches adBreakEntered and adBreakCompleted from the ad controller', async () => {
        await setContent(trackAds(makeBreak({ startTime: 10, duration: 5 })))
        const entered = createEventSpy(player, 'adBreakEntered')
        const completed = createEventSpy(player, 'adBreakCompleted')
        simulateTimeUpdate(11)
        await flush()
        expect(entered).toHaveBeenCalledTimes(1)
        expect(entered.calls.mostRecent().args[0].adBreak.id).toBe('b1')
        // Exit via skipAd (updateTime is blocked while an ad is active)
        player.skipAd()
        expect(completed).toHaveBeenCalledTimes(1)
        expect(completed.calls.mostRecent().args[0].adBreak.id).toBe('b1')
    })

    it('reflects the current ad break through the player getter', async () => {
        await setContent(trackAds(makeBreak({ startTime: 0, duration: 10 })))
        simulateTimeUpdate(5)
        await flush()
        expect(player.currentAdBreak?.id).toBe('b1')
    })

    it('reflects the current ad through the player getter', async () => {
        await setContent(trackAds(makeBreak({ startTime: 0, duration: 10 })))
        expect(player.currentAd).toBeNull()
        simulateTimeUpdate(5)
        await flush()
        expect(player.currentAd?.id).toBe('a1')
    })

    it('skipAd delegates to the ad controller', async () => {
        await setContent(trackAds(makeBreak({ startTime: 0, duration: 10 })))
        simulateTimeUpdate(5)
        await flush()
        expect(player.currentAdBreak).not.toBeNull()
        player.skipAd()
        expect(player.currentAdBreak).toBeNull()
    })

    it('skipAdBreak delegates to the ad controller', async () => {
        await setContent(trackAds(makeBreak({ startTime: 0, duration: 10 })))
        simulateTimeUpdate(5)
        await flush()
        player.skipAdBreak()
        expect(player.currentAdBreak).toBeNull()
    })

    it('skipAd is a no-op without an active break', () => {
        expect(() => player.skipAd()).not.toThrow()
    })

    it('skipAdBreak is a no-op without an active break', () => {
        expect(() => player.skipAdBreak()).not.toThrow()
    })
})
