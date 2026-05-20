/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SegmentReference } from '@/streaming/SegmentReference'
import type { SegmentDataProvider } from '@/streaming/SegmentDataSlot'
import type { MediaQualityMetadata } from '@/streaming/MediaQualityMetadata'
import { sortedInsertionIndex } from '@amazon/vinyl-util'

/**
 * Represents a single quality within a period, providing access to its metadata
 * and segment data.
 */
export interface MediaQualityData {
    readonly metadata: MediaQualityMetadata

    /**
     * Gets the segment reference at the given time, or null if the time is outside the range.
     * @param time The time, in seconds, relative to the presentation timeline.
     */
    getSegment(
        time: number
    ): Promise<SegmentReference<SegmentDataProvider> | null>
}

/**
 * Represents a period within the media timeline.
 */
export interface MediaPeriod {
    readonly startTime: number
    readonly endTime: number
    readonly qualities: readonly MediaQualityData[]
}

/**
 * Represents the full media timeline, composed of one or more periods.
 */
export interface MediaTimeline {
    readonly periods: readonly MediaPeriod[]

    /**
     * The minimum duration of the buffer that a client should maintain for uninterrupted playback.
     */
    readonly minBufferTime: number

    /**
     * The total duration of the media, in seconds.
     * Returns null if duration cannot be determined.
     */
    getDuration?(): Promise<number | null>
}

/**
 * Gets the period spanning the given presentation time.
 */
export function getMediaPeriodAtTime(
    timeline: MediaTimeline,
    time: number
): MediaPeriod | null {
    const index =
        sortedInsertionIndex(timeline.periods, time, (time, period) => {
            return time - period.startTime
        }) - 1
    if (index < 0) return null
    const period = timeline.periods[index]
    return time >= period.endTime ? null : period
}
