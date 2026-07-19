/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    AdControllerImpl,
    createVinylPlayer,
    type AdBreakInfo,
    type VinylDeps,
} from '@amazon/vinyl'
import { externalDependencies, type Factories } from '@amazon/vinyl-di'
import {
    createMockVinylDependencies,
    MockTrack,
    type MockVinylDependencies,
} from '@amazon/vinyl/vinylTestUtil'
import { MockHTMLAudioElement } from '@amazon/vinyl-util/browserTestUtil'
import { createEventSpy } from '@amazon/vinyl-util/testUtil'

describe('VinylPlayer ad break API', () => {
    let deps: MockVinylDependencies
    let depFactories: Factories<VinylDeps>
    let player: ReturnType<typeof createVinylPlayer>

    beforeEach(() => {
        deps = createMockVinylDependencies()
        depFactories = externalDependencies(deps)
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
            ads: [],
            ...overrides,
        }
    }

    function makeTrackWithController(): {
        track: MockTrack
        controller: AdControllerImpl
    } {
        const track = new MockTrack()
        const controller = new AdControllerImpl()
        track.adController = controller
        return { track, controller }
    }

    function activate(track: MockTrack, previous: MockTrack | null = null) {
        deps.trackController.currentTrack = track
        deps.trackController.dispatch('currentTrackChange', {
            previous,
            current: track,
        })
    }

    it('returns empty defaults when there is no current track', () => {
        expect(player.adBreaks).toEqual([])
        expect(player.activeAdBreak).toBeNull()
    })

    it('returns ad breaks from the current track', () => {
        const { track, controller } = makeTrackWithController()
        controller.setAdBreaks([makeBreak()])
        activate(track)
        expect(player.adBreaks.map((b) => b.id)).toEqual(['b1'])
    })

    it('returns empty when current track has no ad controller', () => {
        const track = new MockTrack()
        activate(track)
        expect(player.adBreaks).toEqual([])
        expect(player.activeAdBreak).toBeNull()
    })

    it('redispatches adBreaksChange from the active controller', () => {
        const { track, controller } = makeTrackWithController()
        activate(track)
        const spy = createEventSpy(player, 'adBreaksChange')
        controller.setAdBreaks([makeBreak()])
        expect(spy).toHaveBeenCalled()
    })

    it('redispatches adBreakEnter and adBreakExit from the active controller', () => {
        const { track, controller } = makeTrackWithController()
        controller.setAdBreaks([makeBreak({ startTime: 10, duration: 5 })])
        activate(track)
        const enter = createEventSpy(player, 'adBreakEnter')
        const exit = createEventSpy(player, 'adBreakExit')
        controller.updateTime(11)
        expect(enter).toHaveBeenCalled()
        controller.updateTime(20)
        expect(exit).toHaveBeenCalled()
    })

    it('reflects the active ad break through the player getter', () => {
        const { track, controller } = makeTrackWithController()
        controller.setAdBreaks([makeBreak({ startTime: 0, duration: 10 })])
        activate(track)
        controller.updateTime(5)
        expect(player.activeAdBreak?.id).toBe('b1')
    })

    it('fires adBreaksChange when switching to a track with a different list', () => {
        const a = makeTrackWithController()
        const b = makeTrackWithController()
        a.controller.setAdBreaks([makeBreak({ id: 'a1' })])
        b.controller.setAdBreaks([makeBreak({ id: 'b1' })])
        activate(a.track)
        const spy = createEventSpy(player, 'adBreaksChange')
        deps.trackController.currentTrack = b.track
        deps.trackController.dispatch('currentTrackChange', {
            previous: a.track,
            current: b.track,
        })
        expect(spy).toHaveBeenCalled()
    })

    it('stops redispatching from a track after switching away', () => {
        const a = makeTrackWithController()
        const b = makeTrackWithController()
        activate(a.track)
        deps.trackController.currentTrack = b.track
        deps.trackController.dispatch('currentTrackChange', {
            previous: a.track,
            current: b.track,
        })
        const spy = createEventSpy(player, 'adBreaksChange')
        // The old controller should no longer be wired to the player.
        a.controller.setAdBreaks([makeBreak({ id: 'stale' })])
        expect(spy).not.toHaveBeenCalled()
    })
})
