/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { sortedInsertionIndex } from '@amazon/vinyl-util'
import type { MediaSegmentMetadata } from '../SegmentReference'

/**
 * Returns the segment whose range covers `time` (`startTime <= time < endTime`), or
 * — when `affordance > 0` — the next segment if `time` falls within `affordance`
 * seconds before its `startTime`. Returns `null` if neither applies.
 *
 * Note: with `affordance > 0`, when `time` lies in the last `affordance` seconds of a
 * segment that does cover it, the *next* segment is returned instead. This is
 * deliberate — callers use `affordance` to absorb sub-second boundary differences
 * across qualities — but it means the result is not strictly the segment containing
 * `time`. Callers needing exact containment should pass `affordance = 0`.
 *
 * @param time Lookup time, in seconds.
 * @param segments Segments sorted by `startTime` ascending.
 * @param affordance Forward-snap tolerance in seconds: if `time` falls just before a
 * segment's `startTime` (within `affordance`), that segment is returned. The original
 * `time` is still compared against `endTime`, so coverage never extends past it.
 */
export function getSegmentAtTime<T extends MediaSegmentMetadata>(
    time: number,
    segments: readonly T[],
    affordance = 0
): T | null {
    const index =
        getSegmentInsertionIndexAtTime(time + affordance, segments) - 1
    if (index < 0) return null
    const segment = segments[index]
    return time >= segment.endTime ? null : segment
}

/**
 * Returns the count of segments whose `startTime <= time` — i.e. the index at which a
 * segment with that `startTime` would be inserted to keep the array sorted ascending.
 *
 * @param time Lookup time, in seconds.
 * @param segments Segments sorted by `startTime` ascending.
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
