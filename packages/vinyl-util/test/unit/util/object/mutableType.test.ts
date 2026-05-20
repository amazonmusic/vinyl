/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    Fun,
    Mutable,
    MutableDeep,
    ReadonlyDate,
    ReadonlyMap,
    ReadonlySet,
} from '@amazon/vinyl-util'
import { expectTypeStrictlyEquals } from '@amazon/vinyl-util/browserTestUtil'

describe('MutableDeep', () => {
    it('recursively removes readonly modifiers on a type', () => {
        expectTypeStrictlyEquals<
            MutableDeep<{
                readonly a: string
            }>,
            {
                a: string
            }
        >(true)

        expectTypeStrictlyEquals<
            MutableDeep<{
                readonly a: {
                    readonly b: number
                }
            }>,
            {
                a: {
                    b: number
                }
            }
        >(true)

        expectTypeStrictlyEquals<
            MutableDeep<{
                readonly a: {
                    readonly b: readonly { readonly c: number }[]
                }
            }>,
            {
                a: {
                    b: { c: number }[]
                }
            }
        >(true)
    })

    it('translates ReadonlyDate to Date', () => {
        expectTypeStrictlyEquals<MutableDeep<ReadonlyDate>, Date>(true)
        expectTypeStrictlyEquals<
            MutableDeep<{ readonly foo: ReadonlyDate }>,
            { foo: Date }
        >(true)
    })

    it('translates MutableMap to Map', () => {
        expectTypeStrictlyEquals<
            MutableDeep<ReadonlyMap<string, { readonly a: number }>>,
            Map<string, { a: number }>
        >(true)
    })

    it('translates MutableSet to Set', () => {
        expectTypeStrictlyEquals<
            MutableDeep<ReadonlySet<{ readonly a: number }>>,
            Set<{ a: number }>
        >(true)
    })

    it('removes readonly from properties and methods of classes', () => {
        class Foo {
            readonly bar: number = 0
            readonly method: () => void = () => {}
        }

        expectTypeStrictlyEquals<
            MutableDeep<Foo>,
            {
                bar: number
                method: () => void
            }
        >(true)
    })

    it('preserves tuples up to five in length', () => {
        expectTypeStrictlyEquals<
            MutableDeep<{
                readonly a: readonly [number]
                readonly b: readonly [number, string]
                readonly c: readonly [number, string, boolean]
                readonly d: readonly [number, string, boolean, null]
                readonly e: readonly [number, string, boolean, undefined, null]
            }>,
            {
                a: [number]
                b: [number, string]
                c: [number, string, boolean]
                d: [number, string, boolean, null]
                e: [number, string, boolean, undefined, null]
            }
        >(true)
    })

    it('uses arrays for tuples past the maximum length', () => {
        expectTypeStrictlyEquals<
            MutableDeep<
                readonly [number, string, number, string, number, string]
            >,
            (number | string)[]
        >(true)
    })

    it('uses remove readonly from tuple element types', () => {
        expectTypeStrictlyEquals<
            MutableDeep<{
                readonly a: readonly [{ readonly a: number }]
                readonly b: readonly [
                    { readonly a: number },
                    { readonly b: string },
                ]
                readonly c: readonly [
                    { readonly a: number },
                    { readonly b: number },
                    { readonly c: boolean },
                ]
                readonly d: readonly [
                    { readonly a: number },
                    { readonly b: number },
                    { readonly c: boolean },
                    { readonly d: string | null },
                ]
            }>,
            {
                a: [{ a: number }]
                b: [{ a: number }, { b: string }]
                c: [{ a: number }, { b: number }, { c: boolean }]
                d: [
                    { a: number },
                    { b: number },
                    { c: boolean },
                    { d: string | null },
                ]
            }
        >(true)
    })

    it('preserves Blob type', () => {
        expectTypeStrictlyEquals<MutableDeep<Blob>, Blob>(true)
    })

    it('preserves function type', () => {
        expectTypeStrictlyEquals<MutableDeep<Fun>, Fun>(true)
    })
})

describe('Mutable', () => {
    it('removes readonly modifiers on a type', () => {
        expectTypeStrictlyEquals<
            Mutable<{
                readonly a: string
            }>,
            {
                a: string
            }
        >(true)

        expectTypeStrictlyEquals<
            Mutable<{
                readonly a: {
                    readonly b: number
                }
            }>,
            {
                a: {
                    // Should not change deep members
                    readonly b: number
                }
            }
        >(true)

        expectTypeStrictlyEquals<
            Mutable<{
                readonly a: {
                    readonly b: readonly { readonly c: number }[]
                }
            }>,
            {
                a: {
                    // Deep members
                    readonly b: readonly { readonly c: number }[]
                }
            }
        >(true)
    })

    it('translates ReadonlyDate to Date', () => {
        expectTypeStrictlyEquals<Mutable<ReadonlyDate>, Date>(true)
        expectTypeStrictlyEquals<
            // Deep
            Mutable<{ readonly foo: Date }>,
            { foo: Date }
        >(true)
    })

    it('translates MutableMap to Map', () => {
        expectTypeStrictlyEquals<
            Mutable<ReadonlyMap<string, { readonly a: number }>>,
            Map<string, { readonly a: number }>
        >(true)
    })

    it('translates MutableSet to Set', () => {
        expectTypeStrictlyEquals<
            Mutable<ReadonlySet<{ readonly a: number }>>,
            Set<{ readonly a: number }>
        >(true)
    })

    it('removes readonly from properties and methods of classes', () => {
        class Foo {
            readonly bar: number = 0
            readonly method: () => void = () => {}
        }

        expectTypeStrictlyEquals<
            Mutable<Foo>,
            {
                bar: number
                method: () => void
            }
        >(true)
    })

    it('removes readonly from arrays', () => {
        expectTypeStrictlyEquals<Mutable<readonly number[]>, number[]>(true)
    })

    it('removes readonly from tuples', () => {
        expectTypeStrictlyEquals<Mutable<readonly [1]>, [1]>(true)
        expectTypeStrictlyEquals<Mutable<readonly [1, 2]>, [1, 2]>(true)
        expectTypeStrictlyEquals<Mutable<readonly [1, 2, 3]>, [1, 2, 3]>(true)
        expectTypeStrictlyEquals<Mutable<readonly [1, 2, 3, 4]>, [1, 2, 3, 4]>(
            true
        )
        expectTypeStrictlyEquals<
            Mutable<readonly [1, 2, 3, 4, 5]>,
            [1, 2, 3, 4, 5]
        >(true)
    })

    it('preserves Blob type', () => {
        expectTypeStrictlyEquals<Mutable<Blob>, Blob>(true)
    })

    it('preserves function type', () => {
        expectTypeStrictlyEquals<Mutable<Fun>, Fun>(true)
    })
})
