/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createVinylPlayer,
    SidecarTextTrackController,
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

describe('VinylPlayer text track API', () => {
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

    function makeTrackWithController(): {
        track: MockTrack
        controller: SidecarTextTrackController
    } {
        const track = new MockTrack()
        const controller = new SidecarTextTrackController({ media: null })
        track.textTrackController = controller
        return { track, controller }
    }

    it('returns empty defaults when no current track', () => {
        expect(player.textTracks).toEqual([])
        expect(player.activeTextTrack).toBeNull()
    })

    it('returns text tracks from the current track', () => {
        const { track, controller } = makeTrackWithController()
        controller.setTextTracks([
            {
                id: 't1',
                kind: 'subtitles',
                language: 'en',
                label: 'English',
                default: false,
                uri: 'https://x/sub.vtt',
                mimeType: 'text/vtt',
            },
        ])
        deps.trackController.currentTrack = track
        deps.trackController.dispatch('currentTrackChange', {
            previous: null,
            current: track,
        })
        expect(player.textTracks.length).toBe(1)
    })

    it('selects an active text track via setActiveTextTrack', () => {
        const { track, controller } = makeTrackWithController()
        controller.setTextTracks([
            {
                id: 't1',
                kind: 'subtitles',
                language: 'en',
                label: 'English',
                default: false,
                uri: 'https://x/sub.vtt',
                mimeType: 'text/vtt',
            },
        ])
        deps.trackController.currentTrack = track
        deps.trackController.dispatch('currentTrackChange', {
            previous: null,
            current: track,
        })
        player.setActiveTextTrack('t1')
        expect(player.activeTextTrack?.id).toBe('t1')
        player.setActiveTextTrack(null)
        expect(player.activeTextTrack).toBeNull()
    })

    it('ignores setActiveTextTrack when current track has no controller', () => {
        const track = new MockTrack()
        deps.trackController.currentTrack = track
        deps.trackController.dispatch('currentTrackChange', {
            previous: null,
            current: track,
        })
        // No throw, and activeTextTrack stays null.
        player.setActiveTextTrack('anything')
        expect(player.activeTextTrack).toBeNull()
    })

    it('redispatches textTracksChange events from the active controller', () => {
        const { track, controller } = makeTrackWithController()
        deps.trackController.currentTrack = track
        deps.trackController.dispatch('currentTrackChange', {
            previous: null,
            current: track,
        })
        const spy = createEventSpy(player, 'textTracksChange')
        controller.setTextTracks([
            {
                id: 't1',
                kind: 'subtitles',
                language: null,
                label: 'A',
                default: false,
                uri: 'a.vtt',
                mimeType: 'text/vtt',
            },
        ])
        expect(spy).toHaveBeenCalled()
    })

    it('fires textTracksChange when switching to a track with different list', () => {
        const a = makeTrackWithController()
        const b = makeTrackWithController()
        const trackInfoA = {
            id: 't1',
            kind: 'subtitles' as const,
            language: 'en',
            label: 'A',
            default: false,
            uri: 'a.vtt',
            mimeType: 'text/vtt',
        }
        const trackInfoB = {
            id: 't2',
            kind: 'subtitles' as const,
            language: 'fr',
            label: 'B',
            default: false,
            uri: 'b.vtt',
            mimeType: 'text/vtt',
        }
        a.controller.setTextTracks([trackInfoA])
        b.controller.setTextTracks([trackInfoB])
        deps.trackController.currentTrack = a.track
        deps.trackController.dispatch('currentTrackChange', {
            previous: null,
            current: a.track,
        })
        const spy = createEventSpy(player, 'textTracksChange')
        deps.trackController.currentTrack = b.track
        deps.trackController.dispatch('currentTrackChange', {
            previous: a.track,
            current: b.track,
        })
        expect(spy).toHaveBeenCalled()
    })

    it("deactivates the previous track's captions on currentTrackChange", () => {
        // Tracks are cached, not disposed, when unloaded. The previous
        // controller retains its DOM TextTrack unless we deactivate it.
        const a = makeTrackWithController()
        a.controller.setTextTracks([
            {
                id: 't1',
                kind: 'subtitles',
                language: 'en',
                label: 'A',
                default: false,
                uri: 'a.vtt',
                mimeType: 'text/vtt',
            },
        ])
        deps.trackController.currentTrack = a.track
        deps.trackController.dispatch('currentTrackChange', {
            previous: null,
            current: a.track,
        })
        a.controller.setActiveTextTrack('t1')
        expect(a.controller.activeTextTrack?.id).toBe('t1')
        // Unload: current → null.
        deps.trackController.currentTrack = null
        deps.trackController.dispatch('currentTrackChange', {
            previous: a.track,
            current: null,
        })
        expect(a.controller.activeTextTrack).toBeNull()
    })

    it('fires activeTextTrackChange when switching tracks', () => {
        const a = makeTrackWithController()
        const b = makeTrackWithController()
        a.controller.setTextTracks([
            {
                id: 't1',
                kind: 'subtitles',
                language: 'en',
                label: 'A',
                default: false,
                uri: 'a.vtt',
                mimeType: 'text/vtt',
            },
        ])
        a.controller.setActiveTextTrack('t1')
        deps.trackController.currentTrack = a.track
        deps.trackController.dispatch('currentTrackChange', {
            previous: null,
            current: a.track,
        })
        const spy = createEventSpy(player, 'activeTextTrackChange')
        deps.trackController.currentTrack = b.track
        deps.trackController.dispatch('currentTrackChange', {
            previous: a.track,
            current: b.track,
        })
        expect(spy).toHaveBeenCalled()
    })

    it('does not emit activeTextTrackChange when neither track has an active selection', () => {
        // Both tracks are text-capable but nothing is active — the current
        // track change should not manufacture a spurious active-change event.
        const a = makeTrackWithController()
        const b = makeTrackWithController()
        deps.trackController.currentTrack = a.track
        deps.trackController.dispatch('currentTrackChange', {
            previous: null,
            current: a.track,
        })
        const spy = createEventSpy(player, 'activeTextTrackChange')
        deps.trackController.currentTrack = b.track
        deps.trackController.dispatch('currentTrackChange', {
            previous: a.track,
            current: b.track,
        })
        expect(spy).not.toHaveBeenCalled()
    })
})
