/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type ChangeEvent,
    nextHasMetadata,
    type ReadonlyPlaybackController,
} from '@amazon/vinyl'
import { nextEventAsPromise } from '@amazon/vinyl-util'

/**
 * Waits until the playbackController is in a playing state.
 *
 * @param playbackController The playbackController reference. Can be the player.
 * @param timeout The timeout (in seconds) before the promise will reject with a timeout.
 */
export async function onPlaying(
    playbackController: ReadonlyPlaybackController,
    timeout = 10
): Promise<void> {
    if (playbackController.playing) return Promise.resolve()
    return nextEventAsPromise(playbackController, 'playing', {
        timeout,
        timeoutMessage: 'playing timed out after {time}s',
    }).then(() => void 0)
}

/**
 * Resolves when the playbackController has enough data to play audio without stopping.
 *
 * @param playbackController The playbackController reference. Can be the player.
 * @param timeout The timeout (in seconds) before the promise will reject with a timeout.
 */
export async function onCanPlayThrough(
    playbackController: ReadonlyPlaybackController,
    timeout = 20
): Promise<void> {
    if (playbackController.canPlayThrough) return Promise.resolve()
    return nextEventAsPromise(playbackController, 'canPlayThrough', {
        timeout,
        timeoutMessage: 'canPlayThrough timed out after {time}s',
    }).then(() => void 0)
}

/**
 * Returns a promise that resolves when the playbackController is next in an 'ended' state.
 *
 * @param playbackController The playbackController reference. Can be the player.
 * @param timeout The timeout beyond the remaining track time in which the promise will be
 * rejected with a timeout error.
 * @param metadataTimeout The timeout to await metadata, if metadata is not currently loaded.
 */
export async function onEnded(
    playbackController: ReadonlyPlaybackController,
    timeout = 10,
    metadataTimeout = 10
): Promise<void> {
    if (playbackController.ended) return Promise.resolve()
    await nextHasMetadata(playbackController, { timeout: metadataTimeout })
    return nextEventAsPromise(playbackController, 'ended', {
        // Set the timeout to be the remaining track duration plus a large margin of error for stalls and seek
        // inaccuracy.
        timeout:
            playbackController.duration -
            playbackController.currentTime +
            timeout,
        timeoutMessage: 'ended timed out after {time}s',
    }).then(() => void 0)
}

/**
 * Returns a promise that resolves after the next 'timeUpdate' event.
 *
 * @param playbackController The playbackController reference. Can be the player.
 * @param timeout The timeout (in seconds) before the promise will reject with a timeout.
 */
export function onTimeUpdate(
    playbackController: ReadonlyPlaybackController,
    timeout = 5
): Promise<ChangeEvent<number>> {
    return nextEventAsPromise(playbackController, 'timeUpdate', {
        timeout,
        timeoutMessage: 'timeUpdate timed out after {time}s',
    })
}

/**
 * Returns a promise that resolves when the duration is non-zero.
 *
 * @param playbackController The playbackController reference. Can be the player.
 * @param timeout The timeout (in seconds) before the promise will reject with a timeout.
 */
export function onDuration(
    playbackController: ReadonlyPlaybackController,
    timeout = 10
): Promise<void> {
    if (playbackController.duration > 0) return Promise.resolve()
    return nextEventAsPromise(playbackController, 'durationChange', {
        timeout,
        timeoutMessage: 'durationChange timed out after {time}s',
    }).then(() => void 0)
}
