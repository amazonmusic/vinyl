/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { merge } from '@amazon/vinyl-util'
import { expectTypeStrictlyEquals } from '@amazon/vinyl-util/browserTestUtil'
import any = jasmine.any

describe('merge', () => {
    describe('when passed zero arguments', () => {
        it('returns undefined', () => {
            expect(merge()).toBeUndefined()
        })
    })

    describe('when elements are arrays', () => {
        describe('when there is one source', () => {
            it('returns a copied array', () => {
                expect(merge([1, 2, 3])).toEqual([1, 2, 3])
                const arr = [1, 2, 3]
                expect(merge(arr)).not.toBe(arr)
            })
        })
        describe('when there are two sources', () => {
            it('concats the two arrays', () => {
                expect(merge([1], [2, 3])).toEqual([1, 2, 3])
            })
        })

        describe('when there are three sources', () => {
            it('concats the three arrays', () => {
                expect(merge([1], [2, 3], [4, 5])).toEqual([1, 2, 3, 4, 5])
            })
        })
    })

    describe('when elements are objects', () => {
        it('invokes Object.assign', () => {
            const spy = spyOn(Object, 'assign').and.returnValue(true)
            const source1 = {}
            const source2 = {}
            merge(source1, source2)
            expect(spy).toHaveBeenCalledOnceWith(any(Object), source1, source2)
        })

        describe('when there is one source', () => {
            it('returns a shallow copy', () => {
                const source1 = { a: 2, b: 4 } as const
                const ret = merge(source1)
                expect(ret).toEqual(source1)
                expect(ret).not.toBe(source1)
                expectTypeStrictlyEquals<(typeof ret)['a'], 2>(true)
                expectTypeStrictlyEquals<(typeof ret)['b'], 4>(true)
            })
        })

        describe('when there are two sources', () => {
            it('uses the type of later sources for conflicts', () => {
                const source1 = { a: 2, b: 4 } as const
                const source2 = { a: 3, c: 5 } as const
                const ret = merge(source1, source2)
                expect(ret).toEqual({ a: 3, b: 4, c: 5 })
                expectTypeStrictlyEquals<(typeof ret)['a'], 3>(true)
                expectTypeStrictlyEquals<(typeof ret)['b'], 4>(true)
                expectTypeStrictlyEquals<(typeof ret)['c'], 5>(true)
            })
        })

        describe('when there are three sources', () => {
            it('uses the type of later sources for conflicts', () => {
                const source1 = { a: 2, b: 4 } as const
                const source2 = { a: 3, c: 5 } as const
                const source3 = { a: 7, b: 8, d: 6 } as const
                const ret = merge(source1, source2, source3)
                expect(ret).toEqual({ a: 7, b: 8, c: 5, d: 6 })
                expectTypeStrictlyEquals<(typeof ret)['a'], 7>(true)
                expectTypeStrictlyEquals<(typeof ret)['b'], 8>(true)
                expectTypeStrictlyEquals<(typeof ret)['c'], 5>(true)
                expectTypeStrictlyEquals<(typeof ret)['d'], 6>(true)
            })
        })

        describe('when there are four sources', () => {
            it('uses the type of later sources for conflicts', () => {
                const source1 = { a: 2, b: 4 } as const
                const source2 = { a: 3, c: 5 } as const
                const source3 = { a: 7, b: 8, d: 6 } as const
                const source4 = { c: 9, e: 10 } as const
                const ret = merge(source1, source2, source3, source4)
                expect(ret).toEqual({ a: 7, b: 8, c: 9, d: 6, e: 10 })
                expectTypeStrictlyEquals<(typeof ret)['a'], 7>(true)
                expectTypeStrictlyEquals<(typeof ret)['b'], 8>(true)
                expectTypeStrictlyEquals<(typeof ret)['c'], 9>(true)
                expectTypeStrictlyEquals<(typeof ret)['d'], 6>(true)
                expectTypeStrictlyEquals<(typeof ret)['e'], 10>(true)
            })
        })

        describe('when there are more than four sources', () => {
            it('performs an untyped merge', () => {
                const source1 = { a: 2, b: 4 } as const
                const source2 = { a: 3, c: 5 } as const
                const source3 = { a: 7, b: 8, d: 6 } as const
                const source4 = { c: 9, e: 10 } as const
                const source5 = { f: 10, g: 11 } as const
                const ret = merge(source1, source2, source3, source4, source5)
                expect(ret).toEqual({
                    a: 7,
                    b: 8,
                    c: 9,
                    d: 6,
                    e: 10,
                    f: 10,
                    g: 11,
                })
                expectTypeStrictlyEquals<typeof ret, any>(true)
            })
        })
    })
})
