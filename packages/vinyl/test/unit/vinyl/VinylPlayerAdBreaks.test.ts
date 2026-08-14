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
import { createMockVinylDependencies } from '@amazon/vinyl/vinylTestUtil'
import { MockHTMLAudioElement } from '@amazon/vinyl-util/browserTestUtil'
import { createEventSpy } from '@amazon/vinyl-util/testUtil'

describe('VinylPlayer ad break API', () => {
    let adController: AdControllerImpl
    let base: ReturnType<typeof createMockVinylDependencies>
    let depFactories: Factories<VinylDeps>
    let player: ReturnType<typeof createVinylPlayer>

    beforeEach(() => {
        base = createMockVinylDependencies()
        // Use a real ad controller so setAds drives state and events that the
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

    it('returns empty defaults when no ad breaks are set', () => {
        expect(player.currentTrackAds).toBeNull()
        expect(player.currentAdBreak).toBeNull()
    })

    it('returns ad breaks from the player-level ad controller', () => {
        adController.setAds(trackAds(makeBreak()))
        expect(player.currentTrackAds?.adBreaks.map((b) => b.id)).toEqual([
            'b1',
        ])
    })

    it('redispatches currentTrackAdsChange from the ad controller', () => {
        const spy = createEventSpy(player, 'currentTrackAdsChange')
        adController.setAds(trackAds(makeBreak()))
        expect(spy).toHaveBeenCalled()
    })

    it('redispatches currentAdBreakChange from the ad controller', async () => {
        adController.setAds(trackAds(makeBreak({ startTime: 10, duration: 5 })))
        const change = createEventSpy(player, 'currentAdBreakChange')
        simulateTimeUpdate(11)
        await flush()
        expect(change).toHaveBeenCalledTimes(1)
        expect(change.calls.mostRecent().args[0].current?.id).toBe('b1')
        // Exit via skipAd (updateTime is blocked while ad is active)
        player.skipAd()
        expect(change).toHaveBeenCalledTimes(2)
        expect(change.calls.mostRecent().args[0].current).toBeNull()
    })

    it('reflects the current ad break through the player getter', async () => {
        adController.setAds(trackAds(makeBreak({ startTime: 0, duration: 10 })))
        simulateTimeUpdate(5)
        await flush()
        expect(player.currentAdBreak?.id).toBe('b1')
    })

    it('reflects the current ad through the player getter', async () => {
        adController.setAds(trackAds(makeBreak({ startTime: 0, duration: 10 })))
        expect(player.currentAd).toBeNull()
        simulateTimeUpdate(5)
        await flush()
        expect(player.currentAd?.id).toBe('a1')
    })

    it('skipAd delegates to the ad controller', async () => {
        adController.setAds(trackAds(makeBreak({ startTime: 0, duration: 10 })))
        simulateTimeUpdate(5)
        await flush()
        expect(player.currentAdBreak).not.toBeNull()
        player.skipAd()
        expect(player.currentAdBreak).toBeNull()
    })

    it('skipAdBreak delegates to the ad controller', async () => {
        adController.setAds(trackAds(makeBreak({ startTime: 0, duration: 10 })))
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
