/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { UnionRanges, RangesImpl, rangesOf } from '@amazon/vinyl-util'

describe('UnionRanges', () => {
    describe('constructor', () => {
        it('accepts array of ReadonlyRanges', () => {
            const ranges1 = rangesOf([[0, 5]])
            const ranges2 = rangesOf([[3, 8]])
            const union = new UnionRanges([ranges1, ranges2])
            expect(union).toBeDefined()
        })

        it('accepts empty array', () => {
            const union = new UnionRanges([])
            expect(union.ranges).toEqual([])
        })
    })

    describe('ranges getter', () => {
        it('combines ranges from all inner ranges', () => {
            const ranges1 = rangesOf([
                [0, 2],
                [5, 7],
            ])
            const ranges2 = rangesOf([
                [1, 3],
                [6, 8],
            ])
            const union = new UnionRanges([ranges1, ranges2])

            expect(union.ranges).toEqual([
                [0, 3],
                [5, 8],
            ])
        })

        it('merges overlapping ranges', () => {
            const ranges1 = rangesOf([[0, 5]])
            const ranges2 = rangesOf([[3, 8]])
            const union = new UnionRanges([ranges1, ranges2])

            expect(union.ranges).toEqual([[0, 8]])
        })

        it('handles non-overlapping ranges', () => {
            const ranges1 = rangesOf([[0, 2]])
            const ranges2 = rangesOf([[5, 7]])
            const union = new UnionRanges([ranges1, ranges2])

            expect(union.ranges).toEqual([
                [0, 2],
                [5, 7],
            ])
        })

        it('handles removed ranges', () => {
            const ranges1 = new RangesImpl([
                [0, 2],
                [8, 10],
            ])
            const ranges2 = new RangesImpl([
                [5, 7],
                [9, 11],
            ])
            const union = new UnionRanges([ranges1, ranges2])

            expect(union.ranges).toEqual([
                [0, 2],
                [5, 7],
                [8, 11],
            ])
            ranges1.remove(8, 10)
            expect(union.ranges).toEqual([
                [0, 2],
                [5, 7],
                [9, 11],
            ])
            ranges2.remove(9, 11)
            expect(union.ranges).toEqual([
                [0, 2],
                [5, 7],
            ])
            ranges1.clear()
            expect(union.ranges).toEqual([[5, 7]])
        })
    })

    describe('caching behavior', () => {
        it('recomputes ranges each time when useCache is false', () => {
            const ranges1 = new RangesImpl([[0, 2]])
            const union = new UnionRanges([ranges1], {
                useCache: false,
            })

            expect(union.ranges).toEqual([[0, 2]])

            ranges1.add(5, 7)
            expect(union.ranges).toEqual([
                [0, 2],
                [5, 7],
            ])
        })

        it('caches ranges when useCache is true', () => {
            const ranges1 = new RangesImpl([[0, 2]])
            const union = new UnionRanges([ranges1], {
                useCache: true,
            })

            expect(union.ranges).toEqual([[0, 2]])

            ranges1.add(5, 7)
            expect(union.ranges).toEqual([[0, 2]]) // Still cached
        })

        it('recomputes after invalidate when useCache is true', () => {
            const ranges1 = new RangesImpl([[0, 2]])
            const union = new UnionRanges([ranges1], {
                useCache: true,
            })

            expect(union.ranges).toEqual([[0, 2]])

            ranges1.add(5, 7)
            union.invalidate()
            expect(union.ranges).toEqual([
                [0, 2],
                [5, 7],
            ])
        })
    })

    describe('invalidate', () => {
        it('forces recomputation on next access', () => {
            const ranges1 = new RangesImpl([[0, 2]])
            const union = new UnionRanges([ranges1], {
                useCache: true,
            })

            expect(union.ranges).toEqual(ranges1.ranges) // Initial computation
            ranges1.add(5, 7)
            union.invalidate()

            expect(union.ranges).toEqual([
                [0, 2],
                [5, 7],
            ])
        })
    })

    describe('innerRanges getter/setter', () => {
        it('getter returns current innerRanges', () => {
            const ranges1 = rangesOf([[0, 2]])
            const ranges2 = rangesOf([[5, 7]])
            const union = new UnionRanges([ranges1, ranges2])

            expect(union.innerRanges).toEqual([ranges1, ranges2])
        })

        it('setter updates innerRanges and invalidates', () => {
            const ranges1 = rangesOf([[0, 2]])
            const ranges2 = rangesOf([[5, 7]])
            const ranges3 = rangesOf([[10, 12]])

            const union = new UnionRanges([ranges1], { useCache: true })
            expect(union.ranges).toEqual([[0, 2]])

            union.innerRanges = [ranges2, ranges3]
            expect(union.innerRanges).toEqual([ranges2, ranges3])
            expect(union.ranges).toEqual([
                [5, 7],
                [10, 12],
            ])
        })

        it('setter invalidates cached ranges', () => {
            const ranges1 = rangesOf([[0, 2]])
            const ranges2 = rangesOf([[5, 7]])

            const union = new UnionRanges([ranges1], { useCache: true })
            expect(union.ranges).toEqual([[0, 2]]) // Cache initial result

            // Change innerRanges - should invalidate cache
            union.innerRanges = [ranges2]
            expect(union.ranges).toEqual([[5, 7]]) // Should reflect new ranges
        })
    })

    describe('empty getter', () => {
        it('returns true when no ranges', () => {
            const union = new UnionRanges([])
            expect(union.empty).toBeTrue()
        })

        it('returns false when ranges exist', () => {
            const ranges1 = rangesOf([[0, 2]])
            const union = new UnionRanges([ranges1])
            expect(union.empty).toBeFalse()
        })
    })
})
