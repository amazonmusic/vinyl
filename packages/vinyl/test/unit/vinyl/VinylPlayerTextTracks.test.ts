/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createVinylPlayer,
    type TextTrackInfo,
    type VinylDeps,
} from '@amazon/vinyl'
import { externalDependencies, type Factories } from '@amazon/vinyl-di'
import {
    createMockVinylDependencies,
    MockTextTrackController,
    MockTrack,
    type MockVinylDependencies,
} from '@amazon/vinyl/vinylTestUtil'
import { MockHTMLAudioElement } from '@amazon/vinyl-util/browserTestUtil'
import { createEventSpy } from '@amazon/vinyl-util/testUtil'

/**
 * These tests cover the player's read-through getters and event redispatch
 * across track changes. Selection itself is declarative (driven by
 * `VinylOptions.text`), so the tests drive a {@link MockTextTrackController}'s
 * state and events directly rather than calling any imperative select API.
 */
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

    function info(overrides: Partial<TextTrackInfo> = {}): TextTrackInfo {
        return {
            id: 't1',
            kind: 'subtitles',
            language: 'en',
            label: 'A',
            default: false,
            forced: false,
            characteristics: [],
            uri: 'a.vtt',
            mimeType: 'text/vtt',
            ...overrides,
        }
    }

    function makeTrackWithController(): {
        track: MockTrack
        controller: MockTextTrackController
    } {
        const track = new MockTrack()
        const controller = new MockTextTrackController()
        track.textTrackController = controller
        return { track, controller }
    }

    /** Sets the controller's track list and emits the change (as the real one does). */
    function setTracks(
        controller: MockTextTrackController,
        tracks: readonly TextTrackInfo[]
    ): void {
        const previous = controller.textTracks
        controller.textTracks = tracks
        controller.dispatch('textTracksChange', { previous, current: tracks })
    }

    /** Sets the controller's active selection and emits the change. */
    function setActive(
        controller: MockTextTrackController,
        current: TextTrackInfo | null
    ): void {
        const previous = controller.activeTextTrack
        controller.activeTextTrack = current
        controller.dispatch('activeTextTrackChange', { previous, current })
    }

    function activate(track: MockTrack): void {
        deps.trackController.activeTrack = track
        deps.trackController.dispatch('trackActivated', { track })
    }

    it('returns empty defaults when no current track', () => {
        expect(player.textTracks).toEqual([])
        expect(player.activeTextTrack).toBeNull()
    })

    it('returns text tracks from the current track', () => {
        const { track, controller } = makeTrackWithController()
        controller.textTracks = [info()]
        activate(track)
        expect(player.textTracks.length).toBe(1)
    })

    it('reflects the current track controller active selection', () => {
        const { track, controller } = makeTrackWithController()
        controller.textTracks = [info()]
        activate(track)
        setActive(controller, info())
        expect(player.activeTextTrack?.id).toBe('t1')
        setActive(controller, null)
        expect(player.activeTextTrack).toBeNull()
    })

    it('reports null active when the current track has no controller', () => {
        const track = new MockTrack()
        activate(track)
        expect(player.activeTextTrack).toBeNull()
    })

    it('redispatches textTracksChange events from the active controller', () => {
        const { track, controller } = makeTrackWithController()
        activate(track)
        const spy = createEventSpy(player, 'textTracksChange')
        setTracks(controller, [info({ language: null })])
        expect(spy).toHaveBeenCalled()
    })

    it('fires textTracksChange when switching to a track with a different list', () => {
        const a = makeTrackWithController()
        const b = makeTrackWithController()
        setTracks(a.controller, [info({ id: 't1', language: 'en' })])
        setTracks(b.controller, [
            info({ id: 't2', language: 'fr', label: 'B' }),
        ])
        activate(a.track)
        const spy = createEventSpy(player, 'textTracksChange')
        activate(b.track)
        expect(spy).toHaveBeenCalled()
    })

    it('fires activeTextTrackChange when switching tracks', () => {
        const a = makeTrackWithController()
        const b = makeTrackWithController()
        setTracks(a.controller, [info({ id: 't1' })])
        setActive(a.controller, info({ id: 't1' }))
        activate(a.track)
        const spy = createEventSpy(player, 'activeTextTrackChange')
        activate(b.track)
        expect(spy).toHaveBeenCalled()
    })

    it('re-announces the content caption after an ad break so it does not read as off', () => {
        // Regression: enabling captions during an ad and then letting content
        // resume left consumers that track state via activeTextTrackChange
        // believing captions were off, because the outgoing ad controller emits
        // a clearing activeTextTrackChange(null) while the content's preserved
        // (here forced) selection is restored silently on activate().
        const content = makeTrackWithController()
        const contentForced = info({
            id: 'c-forced',
            label: 'English (Forced)',
            default: true,
            forced: true,
            uri: 'c.vtt',
        })
        setTracks(content.controller, [contentForced])
        setActive(content.controller, contentForced)

        const ad = makeTrackWithController()
        const adCc = info({ id: 'ad-cc', label: 'English', uri: 'ad.vtt' })
        setTracks(ad.controller, [adCc])

        // Content becomes current.
        activate(content.track)

        // Enter the ad break: the content selection is preserved (deactivate
        // keeps the selection) rather than cleared.
        deps.adController.currentAdBreak = { placement: 'midroll' } as never
        content.controller.deactivate()
        activate(ad.track)

        // Viewer enables the ad's captions during the break.
        setActive(ad.controller, adCc)
        expect(player.activeTextTrack?.id).toBe('ad-cc')

        // Ad ends, content resumes.
        deps.adController.currentAdBreak = null
        const spy = createEventSpy(player, 'activeTextTrackChange')
        content.controller.activate()
        activate(content.track)

        // The player reports the content's forced caption as active again and,
        // crucially, the last active-change event announces it — not the ad's
        // clearing null.
        expect(player.activeTextTrack?.id).toBe('c-forced')
        expect(spy).toHaveBeenCalled()
        const lastCurrent = spy.calls.mostRecent().args[0].current
        expect(lastCurrent?.id).toBe('c-forced')
    })

    it('announces empty tracks and null active when the track is torn down', () => {
        // Real teardown (unload) transitions to null: the player must emit the
        // cleared list/selection so consumers see captions go away.
        const a = makeTrackWithController()
        const t = info({ id: 't1' })
        setTracks(a.controller, [t])
        setActive(a.controller, t)
        activate(a.track)

        const tracksSpy = createEventSpy(player, 'textTracksChange')
        const activeSpy = createEventSpy(player, 'activeTextTrackChange')
        // trackDeactivated with no ad break tears the current track down to null.
        deps.trackController.activeTrack = null
        deps.trackController.dispatch('trackDeactivated', { track: a.track })

        expect(tracksSpy).toHaveBeenCalled()
        expect(tracksSpy.calls.mostRecent().args[0].current).toEqual([])
        expect(activeSpy).toHaveBeenCalled()
        expect(activeSpy.calls.mostRecent().args[0].current).toBeNull()
        expect(player.activeTextTrack).toBeNull()
    })

    it('does not emit activeTextTrackChange when neither track has an active selection', () => {
        // Both tracks are text-capable but nothing is active — the current
        // track change should not manufacture a spurious active-change event.
        const a = makeTrackWithController()
        const b = makeTrackWithController()
        activate(a.track)
        const spy = createEventSpy(player, 'activeTextTrackChange')
        activate(b.track)
        expect(spy).not.toHaveBeenCalled()
    })
})
