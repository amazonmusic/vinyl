/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createArrayLikeIterator,
    slice,
    sortedInsertionIndex,
} from '../collection/array'

// Compares with a Range's start value.
function startComparator(value: number, range: Range) {
    return value < range[0] ? -1 : 1
}

// Compares with a Range's end value.
function endComparator(value: number, range: Range) {
    return value <= range[1] ? -1 : 1
}

/**
 * Query utilities for a list of ranges.
 * Ranges are expected to be start, end pairs where no two ranges overlap or touch.
 * All ranges are in incremental order.
 */
export interface ReadonlyRanges extends Iterable<Range> {
    /**
     * Returns true if there are zero ranges.
     */
    readonly empty: boolean

    /**
     * The ranges array like this reader encapsulates.
     * Ranges are [start, end] tuples, they will always be ordered, never touch, and never overlap.
     */
    readonly ranges: ArrayLike<Range>

    /**
     * Returns the range at the given value, or null if all ranges are outside the given tolerance.
     * Range values are considered inclusive.
     * That is, a ReadonlyRanges with `[0, 1]` will return `[0, 1]` for value `1`.
     *
     * @param value The value to compare to current ranges.
     * @param tolerance The tolerance the value may be outside a range and still considered
     * to be within. Default: 0
     */
    getRangeAt(value: number, tolerance?: number): Range | null

    /**
     * Returns the range that includes the entire from-to span, within a given tolerance.
     *
     * Range values are considered inclusive.
     * That is, a `ReadonlyRanges` with `[0, 2]` will return `[0, 2]` for
     * `getRangeContaining(2, 2)` or `getRangeContaining(0, 0)`.
     *
     * `from` does not need to be lesser than `to`.
     *
     * @param from
     * @param to
     * @param tolerance
     */
    getRangeContaining(
        from: number,
        to: number,
        tolerance?: number
    ): Range | null

    /**
     * Returns all ranges where at least part of the range is within the given from-to span.
     *
     * `from` does not need to be lesser than `to`.
     *
     * @param from
     * @param to
     * @param tolerance
     */
    getRangesWithin(from: number, to: number, tolerance?: number): Range[]

    [Symbol.iterator](): IterableIterator<Range>
}

/**
 * A [start, end] tuple.
 */
export type Range = readonly [start: number, end: number]

export abstract class ReadonlyRangesImpl implements ReadonlyRanges {
    /**
     * An accessor to the backed ranges.
     * Implementations must provide an ArrayLike<Range> for random-access reading.
     * This will be called at most once per read operation.
     */
    abstract get ranges(): ArrayLike<Range>

    get empty(): boolean {
        return this.ranges.length === 0
    }

    getRangeAt(value: number, tolerance = 0): Range | null {
        const ranges = this.ranges
        if (ranges.length === 0) return null
        const index = sortedInsertionIndex(ranges, value, startComparator)
        // The insertion index will be 1 higher than the last range where start >= value.
        const range = index <= 0 ? null : ranges[index - 1]
        if (range && value <= range[1] + tolerance) return range
        if (index >= ranges.length) return null
        const next = ranges[index]
        if (next[0] - tolerance <= value) return next
        return null
    }

    getRangeContaining(
        from: number,
        to: number,
        tolerance?: number
    ): Range | null {
        const ranges = this.ranges
        if (ranges.length === 0) return null
        const startRange = this.getRangeAt(from, tolerance)
        if (startRange == null) return null
        const endRange = this.getRangeAt(to, tolerance)
        if (endRange === startRange) return startRange
        return null
    }

    getRangesWithin(from: number, to: number, tolerance = 0): Range[] {
        const ranges = this.ranges
        if (ranges.length === 0) return []
        const startIndex = sortedInsertionIndex(
            ranges,
            Math.min(from, to) - tolerance,
            endComparator
        )
        const endIndex = sortedInsertionIndex(
            ranges,
            Math.max(from, to) + tolerance,
            startComparator
        )
        return slice(ranges, startIndex, endIndex)
    }

    [Symbol.iterator](): IterableIterator<Range> {
        return createArrayLikeIterator(this.ranges)
    }

    toString() {
        return `[${Array.from(this.ranges)
            .map((range) => `[${range[0]}, ${range[1]}]`)
            .join(', ')}]`
    }
}

/**
 * Returns a ReadonlyRanges reader for a fixed array of ranges.
 */
class RangesArrayReader extends ReadonlyRangesImpl implements ReadonlyRanges {
    constructor(private readonly _ranges: readonly Range[]) {
        super()
    }

    get ranges(): ArrayLike<Range> {
        return this._ranges
    }
}

/**
 * Creates a ReadonlyRanges view for the given array of ranges.
 *
 * @param value An array of ranges. The ReadonlyRanges reader does not clone
 * this value and will access this backing array directly.
 */
export function rangesOf(value: readonly Range[]): ReadonlyRanges {
    return new RangesArrayReader(value)
}

/**
 * A static, empty ranges representation.
 */
export const emptyRanges: ReadonlyRanges = new RangesArrayReader([])

/**
 * A collection of Range start/end tuples.
 * When ranges are added they are merged and sorted, making for fast within range checks.
 */
export class RangesImpl implements ReadonlyRanges {
    private readonly reader: ReadonlyRanges
    readonly ranges: Range[] = []

    /**
     * @param ranges The non-normalized ranges to add.
     * @see #add
     */
    constructor(ranges: readonly Range[] = []) {
        for (const range of ranges) {
            this.add(range[0], range[1])
        }
        this.reader = new RangesArrayReader(this.ranges)
    }

    get empty(): boolean {
        return this.reader.empty
    }

    /**
     * Adds the given range to this list.
     * If end is less than start, the range will not be added.
     * Ranges will be merged when there is overlap or touching. Example,
     * `add(1, 4); add(2, 5)` results in the final ranges: `[1, 5]`
     */
    add(start: number, end: number) {
        if (end < start) return
        const startIndex = sortedInsertionIndex(
            this.ranges,
            start,
            endComparator
        )
        const endIndex = sortedInsertionIndex(
            this.ranges,
            end,
            startComparator,
            startIndex
        )
        const newStart =
            startIndex < this.ranges.length
                ? Math.min(this.ranges[startIndex][0], start)
                : start
        const newEnd =
            endIndex > 0 ? Math.max(this.ranges[endIndex - 1][1], end) : end
        this.ranges.splice(startIndex, endIndex - startIndex, [
            newStart,
            newEnd,
        ])
    }

    /**
     * Removes the given range span from this list.
     * Ranges partially intersecting will be changed to not include the start-end span.
     * If start is after end, nothing will be removed.
     */
    remove(start: number, end: number) {
        if (end < start || this.empty) return
        // New ranges created due to cutting existing ones
        const newRanges: Range[] = []
        const startIndex = sortedInsertionIndex(
            this.ranges,
            start,
            endComparator
        )
        const endIndex = sortedInsertionIndex(this.ranges, end, startComparator)
        if (start === end && startIndex === endIndex - 1) {
            // Do not split an encompassing range when start is equal to end.
            const range = this.ranges[startIndex]
            if (range[0] !== range[1]) return
        }
        if (startIndex < this.ranges.length) {
            const previousRange = this.ranges[startIndex]
            if (previousRange[0] < start) {
                newRanges.push([previousRange[0], start])
            }
        }
        if (endIndex > 0) {
            const nextRange = this.ranges[endIndex - 1]
            if (nextRange[1] > end) {
                newRanges.push([end, nextRange[1]])
            }
        }
        this.ranges.splice(startIndex, endIndex - startIndex, ...newRanges)
    }

    /**
     * Clears all ranges.
     */
    clear() {
        this.ranges.length = 0
    }

    getRangeAt(value: number, tolerance = 0): Range | null {
        return this.reader.getRangeAt(value, tolerance)
    }

    getRangeContaining(
        from: number,
        to: number,
        tolerance?: number
    ): Range | null {
        return this.reader.getRangeContaining(from, to, tolerance)
    }

    getRangesWithin(from: number, to: number, tolerance?: number): Range[] {
        return this.reader.getRangesWithin(from, to, tolerance)
    }

    clone(): RangesImpl {
        return new RangesImpl(this.ranges.slice())
    }

    [Symbol.iterator](): IterableIterator<Range> {
        return this.reader[Symbol.iterator]()
    }

    toString() {
        return this.reader.toString()
    }
}

/**
 * Returns true if the two ranges intersect.
 * Adjacent ranges (touching but not overlapping) will not be considered to intersect.
 */
export function rangeIntersects(rangeA: Range, rangeB: Range): boolean {
    return rangeA[0] < rangeB[1] && rangeA[1] > rangeB[0]
}
