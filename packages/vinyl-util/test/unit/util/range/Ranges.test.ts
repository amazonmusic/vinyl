/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Range, rangesOf } from '@amazon/vinyl-util'
import { emptyRanges, rangeIntersects, RangesImpl } from '@amazon/vinyl-util'

describe('RangesImpl', () => {
    describe('constructor', () => {
        it('adds the ranges list provided', () => {
            expect(new RangesImpl([[0, 1]]).ranges).toEqual([[0, 1]])
            expect(
                new RangesImpl([
                    [2, 3],
                    [0, 1],
                ]).ranges
            ).toEqual([
                [0, 1],
                [2, 3],
            ])
        })
    })

    describe('add', () => {
        it('adds ranges ordered by start value and merge overlapping ranges', () => {
            const ranges = new RangesImpl()
            ranges.add(2, 3)
            ranges.add(3, 4)
            ranges.add(0, 1)
            expect(ranges.ranges).toEqual([
                [0, 1],
                [2, 4],
            ])
            ranges.add(5, 7)
            ranges.add(3, 4)
            ranges.add(0, 1)
            expect(ranges.ranges).toEqual([
                [0, 1],
                [2, 4],
                [5, 7],
            ])
            ranges.add(5, 7)
            ranges.add(2, 4)
            ranges.add(0, 1)
            expect(ranges.ranges).toEqual([
                [0, 1],
                [2, 4],
                [5, 7],
            ])
            ranges.add(8, 9)
            ranges.add(3, 4)
            ranges.add(0, 1)
            ranges.add(3, 6)
            ranges.add(3, 6)
            expect(ranges.ranges).toEqual([
                [0, 1],
                [2, 7],
                [8, 9],
            ])
            ranges.add(-1, -1)
            expect(ranges.ranges).toEqual([
                [-1, -1],
                [0, 1],
                [2, 7],
                [8, 9],
            ])
            ranges.add(-1, 0)
            expect(ranges.ranges).toEqual([
                [-1, 1],
                [2, 7],
                [8, 9],
            ])
            ranges.add(9, 10)
            expect(ranges.ranges).toEqual([
                [-1, 1],
                [2, 7],
                [8, 10],
            ])
            ranges.add(-3, 13)
            expect(ranges.ranges).toEqual([[-3, 13]])
            ranges.add(-4, -3)
            expect(ranges.ranges).toEqual([[-4, 13]])
        })

        it('ignores ranges where start is after end', () => {
            const ranges = new RangesImpl()
            ranges.add(4, 3)
            ranges.add(0, -1)
            ranges.add(2, 1)
            expect(ranges.ranges).toEqual([])
        })
    })

    describe('remove', () => {
        it('does nothing if end is before start', () => {
            const ranges = new RangesImpl([[0, 10]])
            ranges.remove(5, 4)
            expect(ranges.ranges).toEqual([[0, 10]])
        })

        it('does nothing if ranges are empty', () => {
            const ranges = new RangesImpl([])
            ranges.remove(5, 4)
            expect(ranges.ranges).toEqual([])
        })

        it('removes ranges entirely enclosed by the start-end range', () => {
            const ranges = new RangesImpl([
                [0, 1],
                [2, 3],
                [4, 5],
                [6, 7],
            ])
            ranges.remove(2, 5)
            expect(ranges.ranges).toEqual([
                [0, 1],
                [6, 7],
            ])
        })

        it('splits ranges entirely enclosing the start-end range', () => {
            const ranges = new RangesImpl([
                [0, 10],
                [15, 25],
            ])
            ranges.remove(2, 5)
            expect(ranges.ranges).toEqual([
                [0, 2],
                [5, 10],
                [15, 25],
            ])
            ranges.remove(20, 22)
            expect(ranges.ranges).toEqual([
                [0, 2],
                [5, 10],
                [15, 20],
                [22, 25],
            ])
        })

        it('does nothing when start-end range has no intersection', () => {
            // Technically, it's OK if there is still an array operation as long as the result is
            // the same. No need to enforce strict equality.
            const ranges = new RangesImpl([
                [0, 5],
                [6, 7],
                [8, 10],
            ])
            const expectSame = () => {
                expect(ranges.ranges).toEqual([
                    [0, 5],
                    [6, 7],
                    [8, 10],
                ])
            }
            ranges.remove(5, 6)
            expectSame()
            ranges.remove(7, 8)
            expectSame()
            ranges.remove(-3, -1)
            expectSame()
            ranges.remove(-1, 0)
            expectSame()
            ranges.remove(10, 11)
            expectSame()
            ranges.remove(11, 30)
            expectSame()
        })

        it('truncates ranges partially intersecting the removed start-end range', () => {
            const ranges = new RangesImpl([
                [0, 5],
                [6, 7],
                [8, 10],
                [13, 15],
                [17, 20],
            ])
            ranges.remove(3, 9)
            expect(ranges.ranges).toEqual([
                [0, 3],
                [9, 10],
                [13, 15],
                [17, 20],
            ])
            ranges.remove(11, 14)
            expect(ranges.ranges).toEqual([
                [0, 3],
                [9, 10],
                [14, 15],
                [17, 20],
            ])
            ranges.remove(18, 21)
            expect(ranges.ranges).toEqual([
                [0, 3],
                [9, 10],
                [14, 15],
                [17, 18],
            ])
            ranges.remove(9, 18)
            expect(ranges.ranges).toEqual([[0, 3]])
        })

        describe('when start is equal to end', () => {
            it('removes ranges with equal start and end', () => {
                const ranges = new RangesImpl([[0, 0]])
                ranges.remove(1, 1)
                expect(ranges.ranges).toEqual([[0, 0]])
                ranges.remove(0, 0)
                expect(ranges.ranges).toEqual([])
            })

            it('does not split an encompassing range', () => {
                const ranges = new RangesImpl([[0, 10]])
                ranges.remove(5, 5)
                expect(ranges.ranges).toEqual([[0, 10]])
            })
        })
    })

    describe('isEmpty', () => {
        it('returns true if there are zero ranges', () => {
            expect(new RangesImpl().empty).toBeTrue()
            expect(new RangesImpl([[1, 2]]).empty).toBeFalse()
        })
    })

    describe('getRangeAt', () => {
        it('returns the range found within the given tolerance', () => {
            const ranges = new RangesImpl([
                [0, 1],
                [3, 5],
                [7, 10],
            ])
            expect(ranges.getRangeAt(-1)).toBeNull()
            expect(ranges.getRangeAt(-0.1, 0.1)).toEqual([0, 1])
            expect(ranges.getRangeAt(0)).toEqual([0, 1])
            expect(ranges.getRangeAt(1)).toEqual([0, 1]) // Inclusive
            expect(ranges.getRangeAt(2)).toBeNull()
            expect(ranges.getRangeAt(2.9, 0.1)).toEqual([3, 5])
            expect(ranges.getRangeAt(3)).toEqual([3, 5])
            expect(ranges.getRangeAt(4)).toEqual([3, 5])
            expect(ranges.getRangeAt(5)).toEqual([3, 5]) // Inclusive
            expect(ranges.getRangeAt(5, 0.1)).toEqual([3, 5])
            expect(ranges.getRangeAt(6)).toBeNull()
            expect(ranges.getRangeAt(7)).toEqual([7, 10])
            expect(ranges.getRangeAt(8)).toEqual([7, 10])
            expect(ranges.getRangeAt(9)).toEqual([7, 10])
            expect(ranges.getRangeAt(9.99)).toEqual([7, 10])
            expect(ranges.getRangeAt(10)).toEqual([7, 10]) // Inclusive
            expect(ranges.getRangeAt(10.1, 0.1)).toEqual([7, 10])
            expect(ranges.getRangeAt(11)).toBeNull()
        })

        describe('when multiple ranges are within the given tolerance', () => {
            it('returns the range where the range start is closest lesser', () => {
                const ranges = new RangesImpl([
                    [3, 4],
                    [5, 6],
                    [7, 8],
                ])
                expect(ranges.getRangeAt(4.1, 1)).toEqual([3, 4])
                expect(ranges.getRangeAt(4.9, 1)).toEqual([3, 4])
                expect(ranges.getRangeAt(4.1, 5)).toEqual([3, 4])
                expect(ranges.getRangeAt(6.1, 1)).toEqual([5, 6])
                expect(ranges.getRangeAt(5, 10)).toEqual([5, 6])
                expect(ranges.getRangeAt(6, 10)).toEqual([5, 6])
                expect(ranges.getRangeAt(6.9, 10)).toEqual([5, 6])
                expect(ranges.getRangeAt(9, 3)).toEqual([7, 8])
                expect(ranges.getRangeAt(9, 1)).toEqual([7, 8])
            })
        })

        describe('when ranges are empty', () => {
            it('returns null', () => {
                expect(new RangesImpl([]).getRangeAt(0)).toBeNull()
            })
        })
    })

    describe('getRangeContaining', () => {
        it('returns the range that entirely encompasses the given range', () => {
            const ranges = new RangesImpl([
                [-10, -5],
                [1, 6],
                [11, 15],
                [18, 20],
            ])
            expect(ranges.getRangeContaining(-10, -5)).toEqual([-10, -5])
            expect(ranges.getRangeContaining(-6, -5)).toEqual([-10, -5])
            expect(ranges.getRangeContaining(-5, -6)).toEqual([-10, -5])
            expect(ranges.getRangeContaining(-4, -5)).toBeNull()
            expect(ranges.getRangeContaining(-5, -5)).toEqual([-10, -5])
            expect(ranges.getRangeContaining(-4.5, -4.5, 0.5)).toEqual([
                -10, -5,
            ])
            expect(ranges.getRangeContaining(-10.5, -4.5, 0.5)).toEqual([
                -10, -5,
            ])
            expect(ranges.getRangeContaining(-10.6, -4.5, 0.5)).toBeNull()
            expect(ranges.getRangeContaining(-10.5, -4.4, 0.5)).toBeNull()
            expect(ranges.getRangeContaining(-5, -4.4, 0.5)).toBeNull()
            expect(ranges.getRangeContaining(1, 6)).toEqual([1, 6])
            expect(ranges.getRangeContaining(2, 3)).toEqual([1, 6])
            expect(ranges.getRangeContaining(2, 7, 1)).toEqual([1, 6])
            expect(ranges.getRangeContaining(7, 7, 1)).toEqual([1, 6])
            expect(ranges.getRangeContaining(1, 8, 1)).toBeNull()
        })

        describe('when ranges are empty', () => {
            it('returns null', () => {
                expect(new RangesImpl([]).getRangeContaining(0, 0)).toBeNull()
            })
        })
    })

    describe('getRangesWithin', () => {
        it('returns all ranges that are partially within the given range', () => {
            const ranges = new RangesImpl([
                [3, 4],
                [5, 6],
                [7, 8],
            ])
            expect(ranges.getRangesWithin(0, 6)).toEqual([
                [3, 4],
                [5, 6],
            ])
            expect(ranges.getRangesWithin(0, 10)).toEqual([
                [3, 4],
                [5, 6],
                [7, 8],
            ])
            expect(ranges.getRangesWithin(5, 6)).toEqual([[5, 6]])
            expect(ranges.getRangesWithin(4.5, 6.5)).toEqual([[5, 6]])
            expect(ranges.getRangesWithin(5.5, 5.5)).toEqual([[5, 6]])
            expect(ranges.getRangesWithin(0, 4)).toEqual([[3, 4]])
            expect(ranges.getRangesWithin(3, 3)).toEqual([[3, 4]])
            expect(ranges.getRangesWithin(2, 2.5, 0.5)).toEqual([[3, 4]])
        })

        describe('when ranges are empty', () => {
            it('returns empty array', () => {
                expect(new RangesImpl([]).getRangesWithin(0, 999)).toEqual([])
            })
        })
    })

    describe('Symbol.iterator', () => {
        it('provides an iterator for the ranges', () => {
            const ranges = new RangesImpl([
                [0, 1],
                [2, 3],
                [4, 5],
            ])
            expect(Array.from(ranges)).toEqual([
                [0, 1],
                [2, 3],
                [4, 5],
            ])
        })

        it('is an iterable iterator', () => {
            const ranges = new RangesImpl([
                [0, 1],
                [2, 3],
                [4, 5],
            ])
            const iterator = ranges[Symbol.iterator]()
            expect(Array.from(iterator)).toEqual([
                [0, 1],
                [2, 3],
                [4, 5],
            ])
        })
    })

    describe('clear', () => {
        it('removes all ranges', () => {
            const ranges = new RangesImpl([
                [0, 1],
                [2, 3],
                [4, 5],
                [9, 1000],
            ])
            ranges.clear()
            expect(ranges.empty).toBeTrue()
        })
    })

    describe('clone', () => {
        it('returns a new ranges impl with same ranges', () => {
            const ranges = new RangesImpl([
                [0, 1],
                [2, 3],
                [4, 5],
            ])
            const clone = ranges.clone()
            ranges.add(6, 7)
            expect(clone.ranges).toEqual([
                [0, 1],
                [2, 3],
                [4, 5],
            ])
        })
    })

    describe('toString', () => {
        it('returns the ranges comma separated', () => {
            const ranges = new RangesImpl([
                [0, 1],
                [2, 3],
                [4, 5],
            ])
            expect(ranges.toString()).toEqual(`[[0, 1], [2, 3], [4, 5]]`)
        })
    })
})

describe('rangesOf', () => {
    it('accepts an array of ranges', () => {
        const ranges: Range[] = [
            [0, 1],
            [3, 5],
        ]
        const reader = rangesOf(ranges)
        expect(reader.ranges).toBe(ranges)
    })

    it('accepts an empty array', () => {
        const reader = rangesOf([])
        expect(reader.ranges).toEqual([])
        expect(reader.empty).toBeTrue()
    })

    describe('empty', () => {
        it('returns true for empty ranges', () => {
            const reader = rangesOf([])
            expect(reader.empty).toBeTrue()
        })

        it('returns false for non-empty ranges', () => {
            const reader = rangesOf([[0, 1]])
            expect(reader.empty).toBeFalse()
        })
    })

    describe('getRangeAt', () => {
        it('finds ranges at specific values', () => {
            const reader = rangesOf([
                [0, 2],
                [5, 8],
            ])
            expect(reader.getRangeAt(1)).toEqual([0, 2])
            expect(reader.getRangeAt(6)).toEqual([5, 8])
            expect(reader.getRangeAt(3)).toBeNull()
        })
    })

    describe('getRangeContaining', () => {
        it('finds ranges containing a span', () => {
            const reader = rangesOf([
                [0, 10],
                [15, 20],
            ])
            expect(reader.getRangeContaining(2, 5)).toEqual([0, 10])
            expect(reader.getRangeContaining(16, 19)).toEqual([15, 20])
            expect(reader.getRangeContaining(5, 16)).toBeNull()
        })
    })

    describe('getRangesWithin', () => {
        it('finds ranges within a span', () => {
            const reader = rangesOf([
                [1, 3],
                [5, 7],
                [9, 11],
            ])
            expect(reader.getRangesWithin(0, 8)).toEqual([
                [1, 3],
                [5, 7],
            ])
            expect(reader.getRangesWithin(4, 12)).toEqual([
                [5, 7],
                [9, 11],
            ])
        })
    })

    describe('Symbol.iterator', () => {
        it('iterates over ranges', () => {
            const ranges: Range[] = [
                [0, 1],
                [3, 4],
                [6, 7],
            ]
            const reader = rangesOf(ranges)
            expect(Array.from(reader)).toEqual(ranges)
        })
    })
})

describe('emptyRanges', () => {
    it('represents readonly empty ranges', () => {
        expect(emptyRanges.ranges).toEqual([])
    })
})

describe('rangeIntersects', () => {
    it('returns true if two ranges intersect', () => {
        expect(rangeIntersects([0, 1], [1, 2])).toBeFalse()
        expect(rangeIntersects([0, 3], [1, 2])).toBeTrue()
        expect(rangeIntersects([1, 3], [2, 4])).toBeTrue()
        expect(rangeIntersects([5, 8], [4, 9])).toBeTrue()
        expect(rangeIntersects([-2, -1], [-2, -1])).toBeTrue()
        expect(rangeIntersects([-3, -2], [-2, -1])).toBeFalse()
    })
})
