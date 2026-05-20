/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createRangeIter,
    filterIter,
    IllegalArgumentError,
    mapIter,
} from '@amazon/vinyl-util'
import { expectTypeEquals } from '@amazon/vinyl-util/browserTestUtil'

describe('iteration utils', () => {
    describe('createRangeIter', () => {
        it('creates an iterator from start to endInclusive', () => {
            expect(Array.from(createRangeIter(7, 10))).toEqual([7, 8, 9, 10])
            expect(Array.from(createRangeIter(-10, -5))).toEqual([
                -10, -9, -8, -7, -6, -5,
            ])
            expect(Array.from(createRangeIter(3, 3))).toEqual([3])
        })

        it('increments by step', () => {
            expect(Array.from(createRangeIter(10, 20, 2))).toEqual([
                10, 12, 14, 16, 18, 20,
            ])
            expect(Array.from(createRangeIter(20, 10, -2))).toEqual([
                20, 18, 16, 14, 12, 10,
            ])
        })

        it('throws an IllegalArgumentError if step is away from end', () => {
            expect(() => createRangeIter(1, 2, -1)).toThrowMatching(
                (e) => e instanceof IllegalArgumentError
            )
            expect(() => createRangeIter(2, 1, 1)).toThrowMatching(
                (e) => e instanceof IllegalArgumentError
            )
        })
    })

    describe('mapIter', () => {
        it('maps each element of an iterable', () => {
            expect(
                Array.from(mapIter(createRangeIter(0, 2), (it) => `a${it}`))
            ).toEqual(['a0', 'a1', 'a2'])

            const arr = [0, 1, 2, 3]
            const mappedIter = mapIter(arr, (it) => `b${it}`)
            expect(Array.from(mappedIter)).toEqual(['b0', 'b1', 'b2', 'b3'])
            arr.length = 2
            expect(Array.from(mappedIter)).toEqual(['b0', 'b1'])
        })
    })

    describe('filterIter', () => {
        it('reduces the source iterator using the predicate', () => {
            expect(
                Array.from(
                    filterIter(createRangeIter(0, 10), (e) => e % 2 === 0)
                )
            ).toEqual([0, 2, 4, 6, 8, 10])
            expect(
                Array.from(filterIter(createRangeIter(0, 10), () => false))
            ).toEqual([])

            const arr = [true, false, true]
            expect(Array.from(filterIter(arr, (e) => e))).toEqual([true, true])
            arr.push(true, true)
            expect(Array.from(filterIter(arr, (e) => e))).toEqual([
                true,
                true,
                true,
                true,
            ])
        })

        describe('when predicate is a type guard', () => {
            it('narrows the returned Iterable type', () => {
                const onlyTrue = (e: boolean): e is true => e
                const _filtered = filterIter([true, false, true], onlyTrue)
                expectTypeEquals<typeof _filtered, IterableIterator<true>>(true)
            })
        })
    })
})
