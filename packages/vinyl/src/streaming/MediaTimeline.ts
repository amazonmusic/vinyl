/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SegmentReference } from './SegmentReference'
import type { SegmentDataProvider } from './SegmentDataSlot'
import type { MediaQualityMetadata } from './MediaQualityMetadata'
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
     * @param affordance Forward-snap tolerance in seconds: if `time` falls just before a
     * segment's start (within `affordance`), that segment is returned. Defaults to `0`.
     */
    getSegment(
        time: number,
        affordance?: number
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
     * Returns `Infinity` for live streams.
     * Rejects when there are no segments to derive a duration from.
     */
    getDuration(): Promise<number>
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
