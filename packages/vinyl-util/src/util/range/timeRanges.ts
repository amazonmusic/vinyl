/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Range, type ReadonlyRanges, rangesOf } from './Ranges'

/**
 * Converts a `TimeRanges` object to an Array for utility purposes.
 *
 * @param timeRanges
 */
export function timeRangesToArray(timeRanges: TimeRanges): Range[] {
    const ranges: Range[] = []
    for (let i = 0; i < timeRanges.length; i++) {
        ranges.push([timeRanges.start(i), timeRanges.end(i)])
    }
    return ranges
}

/**
 * Creates a reader for a TimeRanges object for easier querying.
 *
 * @param timeRanges
 */
export function createTimeRangesReader(timeRanges: TimeRanges): ReadonlyRanges {
    return rangesOf(timeRangesToArray(timeRanges))
}
