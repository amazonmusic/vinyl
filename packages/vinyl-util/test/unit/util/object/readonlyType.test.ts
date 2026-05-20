/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    ReadonlyDate,
    ReadonlyDeep,
    ReadonlyMap,
    ReadonlySet,
} from '@amazon/vinyl-util'
import { expectTypeStrictlyEquals } from '@amazon/vinyl-util/browserTestUtil'

describe('ReadonlyDeep', () => {
    it('recursively applies readonly modifiers to a type', () => {
        interface Foo {
            a: string
            b: number
            c: {
                a: string
                b: number
            }
            d: [string, number]
            e: () => void
            f: string[]
        }

        expectTypeStrictlyEquals<ReadonlyDeep<Foo>, Foo>(false)
        expectTypeStrictlyEquals<
            ReadonlyDeep<Foo>,
            {
                readonly a: string
                readonly b: number
                readonly c: {
                    readonly a: string
                    readonly b: number
                }
                readonly d: readonly [string, number]
                readonly e: () => void
                readonly f: readonly string[]
            }
        >(true)
    })

    it('translates Date to ReadonlyDate', () => {
        expectTypeStrictlyEquals<ReadonlyDeep<Date>, ReadonlyDate>(true)
        expectTypeStrictlyEquals<
            ReadonlyDeep<{ foo: Date }>,
            { readonly foo: ReadonlyDate }
        >(true)
    })

    it('translates Map to ReadonlyMapDeep', () => {
        expectTypeStrictlyEquals<
            ReadonlyDeep<Map<string, { a: number }>>,
            ReadonlyMap<string, { readonly a: number }>
        >(true)
    })

    it('translates Map to ReadonlyMapDeep', () => {
        expectTypeStrictlyEquals<
            ReadonlyDeep<Set<{ a: number }>>,
            ReadonlySet<{ readonly a: number }>
        >(true)
    })

    it('marks properties and methods of classes as readonly', () => {
        class Foo {
            bar = 0

            method(): void {}
        }

        expectTypeStrictlyEquals<
            ReadonlyDeep<Foo>,
            { readonly bar: number; readonly method: () => void }
        >(true)
    })

    it('preserves tuples up to five in length', () => {
        expectTypeStrictlyEquals<
            ReadonlyDeep<{
                a: [number]
                b: [number, string]
                c: [number, string, boolean]
                d: [number, string, boolean, null]
                e: [number, string, boolean, undefined, null]
            }>,
            {
                readonly a: readonly [number]
                readonly b: readonly [number, string]
                readonly c: readonly [number, string, boolean]
                readonly d: readonly [number, string, boolean, null]
                readonly e: readonly [number, string, boolean, undefined, null]
            }
        >(true)

        expectTypeStrictlyEquals<
            ReadonlyDeep<{
                a: readonly [{ foo: number }, { bar: string }]
                b: [{ foo: number }, { bar: string }]
            }>,
            {
                readonly a: readonly [
                    { readonly foo: number },
                    { readonly bar: string },
                ]
                readonly b: readonly [
                    { readonly foo: number },
                    { readonly bar: string },
                ]
            }
        >(true)
    })

    it('uses arrays for tuples past the maximum length', () => {
        expectTypeStrictlyEquals<
            ReadonlyDeep<[number, string, number, string, string, number]>,
            readonly (number | string)[]
        >(true)
    })

    it('adds readonly to tuple element types', () => {
        expectTypeStrictlyEquals<
            ReadonlyDeep<{
                a: [{ a: number }]
                b: [{ a: number }, { b: string }]
                c: [{ a: number }, { b: number }, { c: boolean }]
                d: [
                    { a: number },
                    { b: number },
                    { c: boolean },
                    { d: string | null },
                ]
            }>,
            {
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
            }
        >(true)
    })
})
