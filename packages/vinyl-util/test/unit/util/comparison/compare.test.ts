/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { compare, compareBy, reversed } from '@amazon/vinyl-util'

describe('compare', () => {
    it('returns 1 if a is greater than b', () => {
        expect(compare(2, 1)).toBe(1)
        expect(compare('b', 'a')).toBe(1)
        expect(compare(true, false)).toBe(1)
    })

    it('returns -1 if b is greater than a', () => {
        expect(compare(1, 2)).toBe(-1)
        expect(compare('a', 'b')).toBe(-1)
        expect(compare(false, true)).toBe(-1)
    })

    it('returns -1 if a is null and b is not', () => {
        expect(compare(null, 1)).toBe(-1)
    })

    it('returns 1 if b is null and a is not', () => {
        expect(compare(1, null)).toBe(1)
    })

    it('returns 0 if a is equal to a', () => {
        expect(compare(1, 1)).toBe(0)
        expect(compare('a', 'a')).toBe(0)
        expect(compare(true, true)).toBe(0)
        expect(compare(null, null)).toBe(0)
    })
})

describe('reversed', () => {
    it('negates a compare result', () => {
        expect(reversed(compare)(1, 2)).toBe(1)
        expect(reversed(compare)(1, 1)).toBe(0)
        expect(reversed(compare)(2, 1)).toBe(-1)
    })
})

describe('compareBy', () => {
    it('compares the values returned by selectors', () => {
        expect(
            compareBy<{ a: number }>((v) => v.a)(
                {
                    a: 1,
                },
                {
                    a: 2,
                }
            )
        ).toBe(-1)
        expect(
            compareBy<{ a: number; b: boolean }>((v) => v.b)(
                {
                    a: 1,
                    b: true,
                },
                {
                    a: 2,
                    b: false,
                }
            )
        ).toBe(1)
        expect(
            compareBy<{ a: number; b: boolean }>(
                (v) => v.a,
                (v) => v.b
            )(
                {
                    a: 1,
                    b: true,
                },
                {
                    a: 1,
                    b: false,
                }
            )
        ).toBe(1)
        expect(
            compareBy<{ a: number; b: boolean }>(
                (v) => v.a,
                (v) => v.b
            )(
                {
                    a: 1,
                    b: true,
                },
                {
                    a: 1,
                    b: true,
                }
            )
        ).toBe(0)

        expect(
            compareBy<{ a: number; b: boolean; c: string }>(
                (v) => v.a,
                (v) => v.b,
                (v) => v.c
            )(
                {
                    a: 1,
                    b: true,
                    c: 'a',
                },
                {
                    a: 1,
                    b: true,
                    c: 'b',
                }
            )
        ).toBe(-1)
    })

    it('considers null values before non-null', () => {
        expect(compareBy()(null, null)).toBe(0)
        expect(compareBy()(null, { a: 1 })).toBe(-1)
        expect(compareBy()({ a: 1 }, null)).toBe(1)
    })
})
