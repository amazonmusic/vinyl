/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NumberSchema, ValueSchema } from '@amazon/vinyl-validation'
import { number } from '@amazon/vinyl-validation'

describe('NumberSchema', () => {
    describe('assert', () => {
        it('asserts the input is a number', () => {
            const v: NumberSchema = number()
            v.validate(3)
            const v2: NumberSchema = v.lt(2)
            expect(v.isValid(null)).toBeFalse()
            v2.validate(1)
            expect(v.validate('str')).toEqual([
                {
                    message: 'Expected: type number, but was: "str". At: ',
                    path: [],
                },
            ])
        })
    })

    describe('gte', () => {
        it('throws if less than min', () => {
            const v: NumberSchema = number().gte(2)
            expect(v.validate(1)).toEqual([
                {
                    message: 'Expected: at least 2, but was: 1. At: ',
                    path: [],
                },
            ])
            expect(v.isValid(null)).toBeFalse()
            v.validate(2)
            v.validate(3)
        })

        it('allows chaining', () => {
            const v: NumberSchema = number().gte(2).lt(4)
            expect(v.isValid(5)).toBeFalse()
            expect(v.isValid(2)).toBeTrue()
            expect(v.isValid(1)).toBeFalse()
            const v2: NumberSchema = number().lt(2)
            expect(v2.isValid(null)).toBeFalse()
            v2.validate(1)
        })
    })

    describe('gt', () => {
        it('throws if less than or equal to min', () => {
            const v: NumberSchema = number().gt(2)
            expect(v.validate(2)).toEqual([
                {
                    message: 'Expected: greater than 2, but was: 2. At: ',
                    path: [],
                },
            ])
            expect(v.validate(1)).toEqual([
                {
                    message: 'Expected: greater than 2, but was: 1. At: ',
                    path: [],
                },
            ])
            expect(v.isValid(null)).toBeFalse()
            v.validate(3)
        })

        it('allows chaining', () => {
            const v: NumberSchema = number().gt(2).lt(6)
            expect(v.validate(2)).toEqual([
                {
                    message: 'Expected: greater than 2, but was: 2. At: ',
                    path: [],
                },
            ])
            expect(v.validate(6)).toEqual([
                {
                    message: 'Expected: less than 6, but was: 6. At: ',
                    path: [],
                },
            ])
            v.validate(3)
            expect(v.isValid(null)).toBeFalse()
        })
    })

    describe('lte', () => {
        it('throws if greater than max', () => {
            const v: NumberSchema = number().lte(2)
            expect(v.validate(3)).toEqual([
                {
                    message: 'Expected: at most 2, but was: 3. At: ',
                    path: [],
                },
            ])
            expect(v.isValid(null)).toBeFalse()
            expect(v.isValid(undefined)).toBeFalse()
            v.validate(2)
            v.validate(1)
        })
    })

    describe('lt', () => {
        it('throws if greater than or equal to max', () => {
            const v: NumberSchema = number().lt(2)
            expect(v.validate(2)).toEqual([
                {
                    message: 'Expected: less than 2, but was: 2. At: ',
                    path: [],
                },
            ])
            expect(v.validate(3)).toEqual([
                {
                    message: 'Expected: less than 2, but was: 3. At: ',
                    path: [],
                },
            ])
            expect(v.isValid(null)).toBeFalse()
            v.validate(1)
        })

        it('allows chaining', () => {
            const v: NumberSchema = number().lt(6).gt(2)
            expect(v.validate(2)).toEqual([
                {
                    message: 'Expected: greater than 2, but was: 2. At: ',
                    path: [],
                },
            ])
            expect(v.validate(6)).toEqual([
                {
                    message: 'Expected: less than 6, but was: 6. At: ',
                    path: [],
                },
            ])
            v.validate(3)
            const v2: ValueSchema<number | null> = number().lt(2).orNull()
            expect(v2.isValid(null)).toBeTrue()
            v2.validate(1)
        })
    })

    describe('within', () => {
        it('validates that a number is within min and max (inclusive)', () => {
            const v: NumberSchema = number().within(3, 6)
            expect(v.validate(2)).toEqual([
                {
                    message: 'Expected: within 3 and 6, but was: 2. At: ',
                    path: [],
                },
            ])
            expect(v.validate(7)).toEqual([
                {
                    message: 'Expected: within 3 and 6, but was: 7. At: ',
                    path: [],
                },
            ])
            expect(v.isValid(null)).toBeFalse()
            v.validate(3)
            v.validate(3.01)
            v.validate(4)
            v.validate(5.9)
            v.validate(6)
        })
    })

    describe('finite', () => {
        it('validates that a number is finite', () => {
            const v: NumberSchema = number().finite()
            expect(v.validate(NaN)).toEqual([
                {
                    message: 'Expected: finite, but was: NaN. At: ',
                    path: [],
                },
            ])
            expect(v.validate(Number.POSITIVE_INFINITY)).toEqual([
                {
                    message: 'Expected: finite, but was: Infinity. At: ',
                    path: [],
                },
            ])
            expect(v.isValid(null)).toBeFalse()
            v.validate(3.4)
        })

        it('supports chaining', () => {
            const v: NumberSchema = number().finite()
            expect(v.validate(NaN)).toEqual([
                {
                    message: 'Expected: finite, but was: NaN. At: ',
                    path: [],
                },
            ])
            expect(v.isValid(null)).toBeFalse()
            v.validate(3.4)
        })
    })

    describe('safeInteger', () => {
        it('validates that a number is finite', () => {
            const v: NumberSchema = number().safeInteger()
            expect(v.validate(3.4)).toEqual([
                {
                    message: 'Expected: safe integer, but was: 3.4. At: ',
                    path: [],
                },
            ])
            expect(v.validate(Number.MAX_SAFE_INTEGER + 1)).toEqual([
                {
                    message:
                        'Expected: safe integer, but was: 9007199254740992. At: ',
                    path: [],
                },
            ])
            v.validate(3)
        })
    })
})
