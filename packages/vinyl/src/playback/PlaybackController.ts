/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReadonlyPlaybackController } from './ReadonlyPlaybackController'

export interface PlaybackController extends ReadonlyPlaybackController {
    defaultPlaybackRate: number
    loop: boolean
    muted: boolean
    playbackRate: number
    preservesPitch: boolean
    volume: number

    /**
     * Pauses playback of the media, if the media is already in a paused state
     * this method will have no effect.
     * If a play is pending, the play will be aborted and the promise returned by play() will be
     * rejected.
     *
     * @see pendingPlay
     * @see play
     */
    pause(): void

    /**
     * Attempts to begin playback of the media. It returns a Promise which is resolved when
     * playback has been successfully started.
     *
     * Failure to begin playback for any reason, such as permission issues or interruption via
     * pause, results in the promise being rejected.
     *
     * The first time play() is invoked, except muted video, should be in response to a user
     * interaction such as a button click.
     *
     * @see isNotAllowedError
     */
    play(): Promise<void>

    /**
     * Safely seeks to the given time.
     * The seek will begin only after {@link readyState} is at least
     * {@link PlaybackReadyState.HAVE_METADATA}.
     * If a previous seek was still pending, the previous seek will be ignored.
     * Returns a Promise that resolves when the seek has completed. If the seek is interrupted
     * by another seek, the promise will be rejected with an `AbortError`.
     * If the seek is not to a seekable range, the promise will reject with an {@link InvalidSeekError}.
     *
     * @param time The value, in seconds, to set the playback time.
     * @param tolerance The amount of tolerance to have when the time is outside the seekable
     * ranges to snap, in seconds. If time is outside all seekable ranges beyond this tolerance,
     * the seek will be ignored. Default: 0.5
     */
    seekTo(time: number, tolerance?: number): Promise<void>

    /**
     * Resets the error state.
     */
    reset(): void
}

/**
 * The maximum duration media can be before it is considered 'live'.
 */
export const LIVE_DURATION = 4294967296 // 2 ** 32
