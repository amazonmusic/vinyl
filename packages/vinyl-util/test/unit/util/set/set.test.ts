/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { diff, union } from '@amazon/vinyl-util'

describe('set utils', () => {
    describe('union', () => {
        it('returns the union of two sets', () => {
            expect(union(new Set(['a', 'b', 'c']), new Set([1, 2, 3]))).toEqual(
                new Set(['a', 'b', 'c', 1, 2, 3])
            )
            expect(
                union(new Set(['a', 'b', 'c']), new Set(['a', 'd']))
            ).toEqual(new Set(['a', 'b', 'c', 'd']))
            expect(union(new Set(['a', 'b', 'c']), new Set())).toEqual(
                new Set(['a', 'b', 'c'])
            )
            expect(union(new Set(), new Set(['a', 'b', 'c']))).toEqual(
                new Set(['a', 'b', 'c'])
            )
            expect(
                union(new Set(['a', 'b', 'c']), new Set(['a', 'b', 'c']))
            ).toEqual(new Set(['a', 'b', 'c']))
        })
    })

    describe('diff', () => {
        it('returns the difference of two sets', () => {
            expect(diff(new Set(['a', 'b', 'c']), new Set(['a', 'd']))).toEqual(
                new Set(['b', 'c'])
            )
            expect(diff(new Set(['a', 'b', 'c']), new Set())).toEqual(
                new Set(['a', 'b', 'c'])
            )
        })
    })
})
