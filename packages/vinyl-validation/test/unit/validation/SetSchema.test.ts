/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SetSchema } from '@amazon/vinyl-validation'
import { isOneOf, number, set } from '@amazon/vinyl-validation'
import { expectTypeStrictlyEquals } from '@amazon/vinyl-util/browserTestUtil'

describe('SetSchema', () => {
    describe('set', () => {
        it('validates that all values match the given validators', () => {
            const v: SetSchema<Set<number>> = set(number())
            expect(v.isValid({})).toBeFalse()
            expect(v.isValid(new Set())).toBeTrue()
            expect(v.isValid(null)).toBeFalse()

            expect(v.validate(new Set(['str']))).toEqual([
                {
                    message: 'Expected: type number, but was: "str". At: 0',
                    path: ['0'],
                },
            ])

            expect(
                v.validate({
                    a: 1,
                    b: 'test',
                })
            ).toEqual([
                {
                    message:
                        'Expected: Set, but was: {\n' +
                        '  "a": 1,\n' +
                        '  "b": "test"\n' +
                        '}. At: ',
                    path: [],
                },
            ])
        })
    })

    describe('withElements', () => {
        it('narrows the element type', () => {
            const v = set(isOneOf(1, 2, 3)).withElements(isOneOf(2, 3, 4))
            expectTypeStrictlyEquals<typeof v, SetSchema<Set<2 | 3>>>(true)
            expect(v.isValid(new Set([2, 2, 3, 3, 2]))).toBeTrue()
            expect(v.isValid(new Set([2, 2, 3, 4, 2]))).toBeFalse()
        })
    })

    describe('readonly', () => {
        it('casts the type parameter as a ReadonlyRecord', () => {
            const _v = set(number()).readonly()
            expectTypeStrictlyEquals<typeof _v, SetSchema<ReadonlySet<number>>>(
                true
            )
        })
    })

    describe('cast', () => {
        it('casts the type parameter', () => {
            const _v = set(number()).cast<Set<string>>()
            expectTypeStrictlyEquals<typeof _v, SetSchema<Set<string>>>(true)
        })
    })
})
