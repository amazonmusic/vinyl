/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createTimeRangesReader, timeRangesToArray } from '@amazon/vinyl-util'
import {
    expectIterableEquals,
    MockTimeRanges,
} from '@amazon/vinyl-util/browserTestUtil'

describe('timeRangesToArray', () => {
    it('converts a TimeRanges object to an array', () => {
        const ranges = timeRangesToArray(
            new MockTimeRanges([
                [0, 1],
                [2, 3],
                [4, 5],
                [8, 9],
            ])
        )
        expectIterableEquals(ranges, [
            [0, 1],
            [2, 3],
            [4, 5],
            [8, 9],
        ])
        expect(ranges.length).toBe(4)
    })
})

describe('createTimeRangesReader', () => {
    describe('getRangeAt', () => {
        it('returns the range found within the given tolerance', () => {
            const reader = createTimeRangesReader(
                new MockTimeRanges([
                    [0, 1],
                    [2, 3],
                    [4, 5],
                    [8, 9],
                ])
            )
            expect(reader.getRangeAt(0)).toEqual([0, 1])
            expect(reader.getRangeAt(-0.1)).toBeNull()
            expect(reader.getRangeAt(1)).toEqual([0, 1])
            expect(reader.getRangeAt(1.1)).toBeNull()
            expect(reader.getRangeAt(2)).toEqual([2, 3])
            expect(reader.getRangeAt(2.1)).toEqual([2, 3])
            expect(reader.getRangeAt(2.9)).toEqual([2, 3])
            expect(reader.getRangeAt(3.1, 0.1)).toEqual([2, 3])
            expect(reader.getRangeAt(3)).toEqual([2, 3])
            expect(reader.getRangeAt(3.1)).toBeNull()
            expect(reader.getRangeAt(3.9)).toBeNull()
            expect(reader.getRangeAt(4)).toEqual([4, 5])
            expect(reader.getRangeAt(5)).toEqual([4, 5])
            expect(reader.getRangeAt(5, 0.1)).toEqual([4, 5])
            expect(reader.getRangeAt(5.1)).toBeNull()
            expect(reader.getRangeAt(8)).toEqual([8, 9])
            expect(reader.getRangeAt(9)).toEqual([8, 9])
            expect(reader.getRangeAt(9.1, 0.1)).toEqual([8, 9])
        })
    })

    describe('Symbol.iterator', () => {
        it('returns an iterator for the TimeRanges', () => {
            const reader = createTimeRangesReader(
                new MockTimeRanges([
                    [-3, -2],
                    [1, 2],
                    [3, 4],
                    [5, 6],
                ])
            )
            expectIterableEquals(reader, [
                [-3, -2],
                [1, 2],
                [3, 4],
                [5, 6],
            ])
        })
    })
})
