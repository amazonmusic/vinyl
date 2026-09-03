/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createVinylSuite, vinylTestAssets } from '@amazon/vinyl/vinylTestUtil'
import { supportsMse, type VinylTrackLoadOptions } from '@amazon/vinyl'
import { poll } from '@amazon/vinyl-util'
import { expectTrackPlaysUntil } from '../../vinylTestUtil/util/playback/expectTrackPlaysUntil'
import {
    onDuration,
    onPlaying,
    onTimeUpdate,
} from '../../vinylTestUtil/util/playback/eventPromises'

/**
 * Integration tests for switching `allowedContentTypes` during playback.
 *
 * Changing the allow list adds or removes whole media streams (and their
 * SourceBuffers). The current track is hard-reset in place: its MediaSource is
 * torn down and recreated with the new set of streams, preserving the playhead
 * and play state. The track object itself is retained (no trackActivated/trackDeactivated).
 * These tests assert that switching works without errors, that playback
 * resumes at the prior playhead, and that the track exposes only the allowed
 * content types.
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
        const wantsVideo =
            allowedContentTypes == null || allowedContentTypes.includes('video')
        player.configure({ allowedContentTypes })
        // The current track is hard-reset in place (no trackActivated/trackDeactivated);
        // wait until its content types reflect the new allow list.
        expect(
            await poll(() => player.contentTypes.has('video') === wantsVideo, {
                timeout: 30,
            })
        )
            .withContext(`content types reflect allowedContentTypes`)
            .toBeTrue()
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

        // The reloaded track seeks back to the prior playhead and resumes
        // playback asynchronously; wait until it plays past that point (which
        // also proves the audio-only track streams without a
        // create-source-buffer error). Content types populate asynchronously
        // too, so only assert on them once playback has resumed.
        await expectTrackPlaysUntil(player, resumeBefore)
        expect(player.contentTypes.has('video'))
            .withContext('video dropped after switch to audio-only')
            .toBeFalse()
        expect(player.contentTypes.has('audio'))
            .withContext('audio retained after switch to audio-only')
            .toBeTrue()

        // Switch back to allowing everything; video returns after another
        // reload. The reloaded full track resumes at the prior playhead and
        // keeps playing without errors.
        const resumeBeforeRestore = player.currentTime
        await reconfigureAllowed(null)
        await expectTrackPlaysUntil(player, resumeBeforeRestore)
        expect(player.contentTypes.has('video'))
            .withContext('video restored after clearing the allow list')
            .toBeTrue()
    }

    /**
     * Plays well into the track, switches content types, and asserts the
     * playhead recovers to (roughly) where it was when the switch happened —
     * a reload that restarted from the beginning, or lost the playhead, would
     * fail. Uses a large switch offset so the recovery target is meaningfully
     * non-zero.
     */
    async function expectPlayheadRecoversAfterSwitch(
        playlist: VinylTrackLoadOptions[]
    ): Promise<void> {
        const player = suite.player
        // Where we switch content types. Large enough that a reset-to-0
        // regression is unambiguous, but kept small to keep the test fast.
        const switchTime = 5
        // Playback can advance while the reload fetches fresh segments and
        // resumes (slower on BrowserStack), so allow the recovered playhead to
        // sit a little ahead of the switch point.
        const reloadAffordance = 10

        player.load(...playlist)
        await player.play()
        await onDuration(player)
        await expectTrackPlaysUntil(player, switchTime)

        const before = player.currentTime
        expect(before)
            .withContext('reached the switch point before reconfiguring')
            .toBeGreaterThanOrEqual(switchTime - 1)

        // Switch to audio-only; the track hard-resets in place, seeking back
        // to the prior playhead before resuming.
        await reconfigureAllowed(['audio'])

        // Once the reloaded track resumes, the playhead must recover near the
        // switch point rather than restart.
        await onPlaying(player)
        await onTimeUpdate(player)
        expect(player.currentTime)
            .withContext('playhead recovered near the switch point')
            .toBeGreaterThanOrEqual(before - 1)
        expect(player.currentTime)
            .withContext('playhead did not skip far ahead during the reload')
            .toBeLessThan(before + reloadAffordance)
    }

    it('DASH reloads the track when switching content types', async () => {
        await playThenSwitch(dashPlaylist)
    })

    it('HLS reloads the track when switching content types', async () => {
        await playThenSwitch(hlsPlaylist)
    })

    it('DASH recovers the playhead after switching content types mid-playback', async () => {
        await expectPlayheadRecoversAfterSwitch(dashPlaylist)
    })

    it('HLS recovers the playhead after switching content types mid-playback', async () => {
        await expectPlayheadRecoversAfterSwitch(hlsPlaylist)
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
