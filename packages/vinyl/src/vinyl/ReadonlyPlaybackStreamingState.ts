/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReadonlyEventHost } from '@amazon/vinyl-util'
import type { TrackEventMap, ReadonlyStreamingState } from '@/track/Track'

/**
 * Represents the streaming state of the currently active track.
 *
 * This interface provides access to the current state of streaming, including:
 * - Fetched data ranges and progress
 * - Streaming quality transitions (streaming, buffering, playback)
 *
 * Consumers can use this interface to monitor streaming progress and quality changes
 * during playback. All properties are read-only and reflect the current state.
 *
 * To react to changes over time, listen to events defined in {@link TrackEventMap}, such as:
 * - `streamingQualityChange`
 * - `bufferingQualityChange`
 * - `playbackQualityChange`
 */

export interface ReadonlyPlaybackStreamingState
    extends ReadonlyEventHost<TrackEventMap>,
        ReadonlyStreamingState {
    /**
     * Returns the time of the prefetch end.
     * If no data has been prefetched for the current track, 0 will be returned.
     *
     * The time given will be in seconds according to the media timeline.
     * It will represent the ending time of the continuous prefetch range from the current playhead time.
     */
    readonly fetchedTime: number

    /**
     * Returns current fetched time as a percent of the total duration.
     *
     * @return A number between 0-1
     */
    readonly fetchedTimePercent: number
}
