/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An implementation of DOM TimeRanges that uses a source array of start/end tuples.
 * For testing purposes only.
 */
export class MockTimeRanges implements TimeRanges {
    constructor(
        private ranges: ReadonlyArray<
            readonly [start: number, end: number]
        > = []
    ) {
        // check the ranges are valid
        for (let i = 1; i < ranges.length; i++) {
            const prev = ranges[i - 1]
            const range = ranges[i]
            if (range[0] >= range[1] || range[0] <= prev[1])
                throw new Error('invalid ranges')
        }
    }

    get length(): number {
        return this.ranges.length
    }

    start(index: number): number {
        return this.ranges[index][0]
    }

    end(index: number): number {
        return this.ranges[index][1]
    }
}
