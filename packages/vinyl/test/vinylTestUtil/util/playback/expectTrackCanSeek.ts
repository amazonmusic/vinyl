/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { getMinSeekableBufferDefault, type VinylPlayer } from '@amazon/vinyl'
import { noop } from '@amazon/vinyl-util'
import { createDisposer } from '@amazon/vinyl-util'
import { closeTo } from '@amazon/vinyl-util'
import { clamp } from '@amazon/vinyl-util'
import { createEventSpy } from '@amazon/vinyl-util/testUtil'
import {
    expectPausedState,
    expectPlayingState,
    expectTimeDoesNotElapse,
    expectTimeElapses,
} from './playbackStateExpectations'
import { onPlaying } from './eventPromises'
import { assertFrequency } from '../../media/FrequencyAnalyzer'

export async function expectTrackCanSeekTo(player: VinylPlayer, time: number) {
    const tolerance = 0.5
    const { dispose, add } = createDisposer()
    const playedSpy = add(createEventSpy(player, 'played'))
    const seekingSpy = add(createEventSpy(player, 'seeking'))
    const seekedSpy = add(createEventSpy(player, 'seeked'))
    // A seek can be re-issued (WebKit sometimes lands the play head off
    // target), producing several seeking/seeked pairs. Track order so we can
    // assert a seeking preceded the first seeked without requiring a single,
    // non-interleaved pair.
    const eventOrder: string[] = []
    add(player.on('seeking', () => eventOrder.push('seeking')))
    add(player.on('seeked', () => eventOrder.push('seeked')))
    const wasPaused = player.paused
    if (player.playing) {
        seekingSpy
            .next()
            .then(() => {
                // If playing before the seek, a played event is expected.
                // Note, there may be another played event before 'seeked' on certain platforms if a playing/waiting pair
                // happens during the seek.
                expect(playedSpy).toHaveBeenCalledBefore(seekingSpy)
            })
            .catch(noop)
    }

    // Expected sequence during a seek:
    // played - if playing
    // seeking
    // timeUpdate
    // seeked
    // loading events such as progress, canPlay, waiting (not tested here)
    // playing - if not paused and can play from new position
    const expectNoop = closeTo(player.currentTime, time, tolerance)
    await player.seekTo(time, tolerance)

    // The end-of-range seek buffer is reserved only while playing (so playback
    // can resume near the end); a paused seek lands right up to the range end.
    const expectedTime = clamp(
        time,
        0,
        player.duration - (wasPaused ? 0 : getMinSeekableBufferDefault())
    )
    // Needs a large tolerance; browser implementations of seek may be imprecise.
    expect(player.currentTime).toBeCloseToWithin(expectedTime, 1)

    if (expectNoop) {
        // Seek expected to no-op
        expect(seekingSpy).not.toHaveBeenCalled()
        expect(seekedSpy).not.toHaveBeenCalled()
    } else {
        // Event expectations:
        // If playing before seekTo: played, seeking, seeked
        // If paused: seeking, seeked.
        // A seeking must precede the first seeked (re-issued seeks allowed).
        expect(eventOrder[0]).withContext('first seek event').toBe('seeking')

        expect(player.paused).withContext('paused').toBe(wasPaused)
        if (wasPaused) {
            expectPausedState(player)
            await expectTimeDoesNotElapse(player)
        } else {
            // If the track was not paused and the new seek position can be played from, then
            // expect that playback resumes
            await onPlaying(player)
            expectPlayingState(player)
            await assertFrequency()
            await expectTimeElapses(player)
        }
    }

    dispose()
}
