/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IntersectionRanges, RangesImpl, rangesOf } from '@amazon/vinyl-util'

describe('IntersectionRanges', () => {
    describe('constructor', () => {
        it('accepts array of ReadonlyRanges', () => {
            const intersection = new IntersectionRanges([
                rangesOf([[0, 5]]),
                rangesOf([[3, 8]]),
            ])
            expect(intersection).toBeDefined()
        })

        it('accepts empty array', () => {
            const intersection = new IntersectionRanges([])
            expect(intersection.ranges).toEqual([])
        })

        it('accepts empty array with useCache', () => {
            const intersection = new IntersectionRanges([], {
                useCache: true,
            })
            expect(intersection.ranges).toEqual([])
        })
    })

    describe('ranges getter', () => {
        it('computes intersection of overlapping ranges', () => {
            const intersection = new IntersectionRanges([
                rangesOf([[0, 10]]),
                rangesOf([[5, 15]]),
            ])

            expect(intersection.ranges).toEqual([[5, 10]])
        })

        it('returns empty for non-overlapping ranges', () => {
            const intersection = new IntersectionRanges([
                rangesOf([[0, 5]]),
                rangesOf([[10, 15]]),
            ])

            expect(intersection.ranges).toEqual([])
        })

        it('handles multiple overlapping segments', () => {
            const intersection = new IntersectionRanges([
                rangesOf([
                    [0, 5],
                    [10, 15],
                    [20, 25],
                ]),
                rangesOf([
                    [3, 12],
                    [22, 30],
                ]),
            ])

            expect(intersection.ranges).toEqual([
                [3, 5], // intersection of [0,5] and [3,12]
                [10, 12], // intersection of [10,15] and [3,12]
                [22, 25], // intersection of [20,25] and [22,30]
            ])
        })

        it('handles three range sets', () => {
            const intersection = new IntersectionRanges([
                rangesOf([[0, 20]]),
                rangesOf([[5, 15]]),
                rangesOf([[8, 12]]),
            ])

            expect(intersection.ranges).toEqual([[8, 12]])
        })

        it('returns empty when any range set is empty', () => {
            const intersection = new IntersectionRanges([
                rangesOf([[0, 10]]),
                rangesOf([]),
                rangesOf([[5, 15]]),
            ])

            expect(intersection.ranges).toEqual([])
        })

        it('handles single range set', () => {
            const intersection = new IntersectionRanges([
                rangesOf([
                    [0, 5],
                    [10, 15],
                ]),
            ])

            expect(intersection.ranges).toEqual([
                [0, 5],
                [10, 15],
            ])
        })
    })

    describe('caching behavior', () => {
        it('recomputes ranges each time when useCache is false', () => {
            const ranges1 = new RangesImpl([[0, 10]])
            const ranges2 = new RangesImpl([[5, 15]])
            const intersection = new IntersectionRanges([ranges1, ranges2], {
                useCache: false,
            })

            expect(intersection.ranges).toEqual([[5, 10]])

            ranges1.add(20, 30)
            ranges2.add(25, 35)
            expect(intersection.ranges).toEqual([
                [5, 10],
                [25, 30],
            ])
        })

        it('caches ranges when useCache is true', () => {
            const ranges1 = new RangesImpl([[0, 10]])
            const ranges2 = new RangesImpl([[5, 15]])
            const intersection = new IntersectionRanges([ranges1, ranges2], {
                useCache: true,
            })

            expect(intersection.ranges).toEqual([[5, 10]])

            ranges1.add(20, 30)
            ranges2.add(25, 35)
            expect(intersection.ranges).toEqual([[5, 10]]) // Still cached
        })

        it('recomputes after invalidate when useCache is true', () => {
            const ranges1 = new RangesImpl([[0, 10]])
            const ranges2 = new RangesImpl([[5, 15]])
            const intersection = new IntersectionRanges([ranges1, ranges2], {
                useCache: true,
            })

            expect(intersection.ranges).toEqual([[5, 10]])

            ranges1.add(20, 30)
            ranges2.add(25, 35)
            intersection.invalidate()
            expect(intersection.ranges).toEqual([
                [5, 10],
                [25, 30],
            ])
        })
    })

    describe('innerRanges getter/setter', () => {
        it('getter returns current innerRanges', () => {
            const ranges1 = rangesOf([[0, 10]])
            const ranges2 = rangesOf([[5, 15]])
            const intersection = new IntersectionRanges([ranges1, ranges2])

            expect(intersection.innerRanges).toEqual([ranges1, ranges2])
        })

        it('setter updates innerRanges and invalidates', () => {
            const ranges1 = rangesOf([[0, 10]])
            const ranges2 = rangesOf([[5, 15]])
            const ranges3 = rangesOf([[8, 12]])

            const intersection = new IntersectionRanges([ranges1, ranges2], {
                useCache: true,
            })
            expect(intersection.ranges).toEqual([[5, 10]])

            intersection.innerRanges = [ranges1, ranges3]
            expect(intersection.innerRanges).toEqual([ranges1, ranges3])
            expect(intersection.ranges).toEqual([[8, 10]])
        })
    })

    describe('empty getter', () => {
        it('returns true when no intersection', () => {
            const intersection = new IntersectionRanges([
                rangesOf([[0, 5]]),
                rangesOf([[10, 15]]),
            ])
            expect(intersection.empty).toBeTrue()
        })

        it('returns false when intersection exists', () => {
            const intersection = new IntersectionRanges([
                rangesOf([[0, 10]]),
                rangesOf([[5, 15]]),
            ])
            expect(intersection.empty).toBeFalse()
        })
    })
})
