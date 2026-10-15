/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VinylPlayer } from '@amazon/vinyl'
import { type TrackLoadOptions } from '@amazon/vinyl'
import { createDisposer } from '@amazon/vinyl-util'
import { createEventSpy } from '@amazon/vinyl-util/testUtil'
import { onDuration } from './eventPromises'
import { expectTrackPlaysUntil } from './expectTrackPlaysUntil'

/**
 * The total amount of time to allow playback for a play test.
 * Plays for PLAYBACK_DURATION / 2, seeks to duration - PLAYBACK_DURATION / 2 and finishes the
 * track.
 */
const PLAYBACK_DURATION = 6

export interface ExpectTrackPlaysOptions {
    /**
     * Multiplies the time allowed to play, for environments that play slower than real time. Default: 1
     */
    readonly timeoutScale?: number
}

export async function expectTrackPlays(
    player: VinylPlayer<any>,
    { timeoutScale = 1 }: ExpectTrackPlaysOptions = {}
): Promise<void> {
    const { dispose, add } = createDisposer()
    const ended = add(createEventSpy(player, 'ended'))
    const timeUpdate = add(createEventSpy(player, 'timeUpdate'))
    expect(player.currentTime)
        .withContext('currentTime starts near the beginning')
        .toBeLessThan(1)
    await onDuration(player) // Wait for duration to be non-zero
    const duration = player.duration
    expect(duration)
        .withContext('duration should be non-zero')
        .toBeGreaterThan(0)

    if (player.duration > PLAYBACK_DURATION) {
        // For longer tracks, play from the beginning, then seek to near the end
        // All tracks will play for at most PLAYBACK_DURATION seconds.
        await expectTrackPlaysUntil(
            player,
            player.currentTime + PLAYBACK_DURATION / 2,
            undefined,
            { timeoutScale }
        )
        const time = player.duration - PLAYBACK_DURATION / 2
        await player.seekTo(time)
    }

    // Expect that playback continues until the end of the track.
    // Do not use expectTrackPlaysUntil; if there is another track in the queue
    // the expectation will fail due to the next track starting.
    // Add a large buffer for the timeout; Seeking in a progressive track
    // can take a long time on some browsers.
    await ended.next((PLAYBACK_DURATION + 10) * timeoutScale)
    expect(player.currentTime).toBeCloseToWithin(duration, 3)
    expect(player.ended).withContext('ended').toBeTrue()
    // Expect at least one update per second. This varies among platforms.
    expect(timeUpdate.calls.count()).toBeGreaterThanOrEqual(
        Math.floor(PLAYBACK_DURATION)
    )
    dispose()
}

/**
 * Asserts that every track in a playlist plays.
 * Has assertions for queue events, playback events, time updates, duration,
 * track changes.
 *
 * @param player
 * @param playlist
 * @param options
 */
export async function expectPlaylistPlays<T extends TrackLoadOptions>(
    player: VinylPlayer<T>,
    playlist: T[],
    { timeoutScale = 1 }: ExpectTrackPlaysOptions = {}
): Promise<void> {
    const { dispose, add } = createDisposer()
    // Add a significant buffer to the timeout; progressive tracks can take a long time to load after a seek.
    const trackTimeout = (PLAYBACK_DURATION + 60) * timeoutScale // Timeout to give each track
    const queueEnded = add(createEventSpy(player, 'queueEnded'))
    const queueChange = add(createEventSpy(player, 'queueChange'))
    const trackChange = add(createEventSpy(player, 'trackActivated'))
    function assertQueueChangeCount(count: number) {
        expect(queueChange).toHaveBeenCalledTimes(count)
        queueChange.calls.reset()
    }
    player.load(...playlist)
    assertQueueChangeCount(1)

    await player.play()
    for (let i = 0; i < playlist.length; i++) {
        const isLastTrack = i === playlist.length - 1
        expect(player.activeTrack?.uri)
            .withContext('activeTrack uri')
            .toBe(playlist[i].uri)
        const nextTrack = isLastTrack
            ? queueEnded.next(trackTimeout)
            : trackChange.next(trackTimeout)
        await Promise.all([
            expectTrackPlays(player, { timeoutScale }),
            nextTrack,
        ])
        assertQueueChangeCount(isLastTrack ? 0 : 1)
    }
    dispose()
}
