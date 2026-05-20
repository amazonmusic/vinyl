/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { sortedInsertionIndex } from '@amazon/vinyl-util'
import type { MediaSegmentMetadata } from '@/streaming/SegmentReference'

/**
 * Returns the segment at the given time, or null if no provided segments fall in the range.
 *
 * @param time
 * @param segments
 */
export function getSegmentAtTime<T extends MediaSegmentMetadata>(
    time: number,
    segments: readonly T[]
): T | null {
    const index = getSegmentInsertionIndexAtTime(time, segments) - 1
    if (index < 0) return null
    const segment = segments[index]
    return time >= segment.endTime ? null : segment
}

/**
 * Returns the segment insertion index at the given time.
 *
 * @param time
 * @param segments
 */
export function getSegmentInsertionIndexAtTime(
    time: number,
    segments: readonly MediaSegmentMetadata[]
): number {
    return sortedInsertionIndex(
        segments,
        time,
        (time, element) => time - element.startTime
    )
}
