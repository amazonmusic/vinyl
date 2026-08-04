/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createVinylSuite, vinylTestAssets } from '@amazon/vinyl/vinylTestUtil'
import { supportsMse, type VinylTrackLoadOptions } from '@amazon/vinyl'
import { nextEventAsPromise } from '@amazon/vinyl-util'
import { expectTrackPlaysUntil } from '../../vinylTestUtil/util/playback/expectTrackPlaysUntil'
import { onDuration } from '../../vinylTestUtil/util/playback/eventPromises'

/**
 * Integration tests for switching `allowedContentTypes` during playback.
 *
 * Changing the allow list adds or removes whole media streams (and their
 * SourceBuffers). SourceBuffers can only be created while the MediaSource is
 * open, so the streams cannot be rebuilt in place on the current track;
 * instead the player fully reloads the current track, recreating the
 * MediaSource. These tests assert that switching works without errors, that
 * the reload preserves the playhead and play state, and that the resulting
 * track exposes only the allowed content types.
 *
 * The suite fails the test on any player `error` event (the default), so a
 * regression that throws a create-source-buffer error surfaces as a failure.
 */
describe('allowedContentTypes switching integ', () => {
    const dashPlaylist: VinylTrackLoadOptions[] = [
        {
            type: 'dash',
            uri: vinylTestAssets.dash
                .live_static_video_audio_60s_2s_segmentTemplate,
        },
    ]
    const hlsPlaylist: VinylTrackLoadOptions[] = [
        {
            type: 'hls',
            uri: vinylTestAssets.hls.live_static_video_audio_60s_2s,
        },
    ]
    const suite = createVinylSuite({}, { timeout: 180 })

    beforeEach(() => {
        if (!supportsMse()) pending('MSE not supported')
    })

    async function reconfigureAllowed(
        allowedContentTypes: readonly ('audio' | 'video')[] | null
    ): Promise<void> {
        const player = suite.player
        // Reloading the current track fires a currentTrackChange as the stale
        // track is torn down and a fresh one is activated.
        const trackChange = nextEventAsPromise(player, 'currentTrackChange', {
            timeout: 30,
            timeoutMessage: 'currentTrackChange timed out after {time}s',
        })
        player.configure({ allowedContentTypes })
        await trackChange
    }

    async function playThenSwitch(
        playlist: VinylTrackLoadOptions[]
    ): Promise<void> {
        const player = suite.player
        player.load(...playlist)
        await player.play()
        await onDuration(player)

        // Play a little of the full (audio + video) content.
        await expectTrackPlaysUntil(player, 3)
        expect(player.contentTypes.has('video'))
            .withContext('starts with video')
            .toBeTrue()
        expect(player.contentTypes.has('audio'))
            .withContext('starts with audio')
            .toBeTrue()

        // Switch to audio only. The track must fully reload (new MediaSource)
        // rather than mutate SourceBuffers in place.
        const resumeBefore = player.currentTime
        await reconfigureAllowed(['audio'])

        // Playback resumes near the prior playhead on the reloaded track.
        expect(player.currentTime)
            .withContext('playhead preserved across reload')
            .toBeGreaterThanOrEqual(resumeBefore - 1)
        expect(player.contentTypes.has('video'))
            .withContext('video dropped after switch to audio-only')
            .toBeFalse()
        expect(player.contentTypes.has('audio'))
            .withContext('audio retained after switch to audio-only')
            .toBeTrue()

        // The reloaded, audio-only track keeps playing without errors.
        await expectTrackPlaysUntil(player, player.currentTime + 3)

        // Switch back to allowing everything; video returns after another
        // reload.
        await reconfigureAllowed(null)
        expect(player.contentTypes.has('video'))
            .withContext('video restored after clearing the allow list')
            .toBeTrue()
        await expectTrackPlaysUntil(player, player.currentTime + 3)
    }

    it('DASH reloads the track when switching content types', async () => {
        await playThenSwitch(dashPlaylist)
    })

    it('HLS reloads the track when switching content types', async () => {
        await playThenSwitch(hlsPlaylist)
    })

    it('DASH applies allowedContentTypes set before load', async () => {
        const player = suite.player
        player.configure({ allowedContentTypes: ['audio'] })
        player.load(...dashPlaylist)
        await player.play()
        await onDuration(player)
        await expectTrackPlaysUntil(player, 3)
        expect(player.contentTypes.has('video'))
            .withContext('video excluded when audio-only configured up front')
            .toBeFalse()
        expect(player.contentTypes.has('audio'))
            .withContext('audio present')
            .toBeTrue()
    })
})
