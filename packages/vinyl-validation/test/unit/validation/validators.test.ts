/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    any,
    array,
    ArraySchema,
    boolean,
    custom,
    enumOf,
    exactlyNull,
    exactlyUndefined,
    func,
    FunctionSchema,
    instanceOf,
    isOneOf,
    nullish,
    number,
    NumberSchema,
    object,
    ObjectSchema,
    string,
    StringSchema,
    symbol,
    type Validator,
    type ValueSchema,
} from '@amazon/vinyl-validation'
import type { Maybe } from '@amazon/vinyl-util'

describe('validators', () => {
    describe('any', () => {
        it('returns a no-op validator', () => {
            const v = any()
            expect(v.isValid(undefined)).toBeTrue()
            expect(v.isValid(null)).toBeTrue()
            expect(v.isValid(3)).toBeTrue()
            expect(v.isValid(['test', 1])).toBeTrue()
        })
    })

    describe('array', () => {
        describe('with zero arguments', () => {
            it('returns ArraySchema.base', () => {
                expect(array()).toBe(ArraySchema.base)
            })
        })

        describe('with an element validator', () => {
            it('returns a validator for an array of elements', () => {
                const v: ArraySchema<string[]> = array(string())
                expect(v.isValid(['test', 1])).toBeFalse()
                expect(v.isValid(['test', 'test2'])).toBeTrue()
                expect(v.isValid(null)).toBeFalse()
            })
        })
    })

    describe('boolean', () => {
        it('returns nullish validators with a boolean validator', () => {
            const v: ValueSchema<boolean> = boolean()
            expect(v.isValid(true)).toBeTrue()
            expect(v.isValid(false)).toBeTrue()
            expect(v.isValid(null)).toBeFalse()
            expect(v.isValid(undefined)).toBeFalse()
            expect(v.validate(1)).toEqual([
                {
                    message: 'Expected: type boolean, but was: 1. At: ',
                    path: [],
                },
            ])

            const notRequired: Validator<Maybe<boolean>> = v.maybe()
            expect(notRequired.isValid(null)).toBeTrue()
            expect(notRequired.isValid(true)).toBeTrue()
            expect(notRequired.isValid(3)).toBeFalse()
        })
    })

    describe('func', () => {
        it('returns FunctionSchema.base', () => {
            expect(func()).toBe(FunctionSchema.base)
        })
    })

    describe('instanceOf', () => {
        it('validates that an input is an instance of the given constructor', () => {
            const v: ValueSchema<Date> = instanceOf(Date)
            expect(v.isValid(new Date())).toBeTrue()
            expect(v.isValid(null)).toBeFalse()
            expect(v.validate(3)).toEqual([
                {
                    message: 'Expected: instance of Date, but was: 3. At: ',
                    path: [],
                },
            ])
        })
    })

    describe('isOneOf', () => {
        it('validates that an input is one of the given enum values', () => {
            const v: ValueSchema<1 | 2 | 3> = isOneOf(1, 2, 3)
            expect(v.isValid(1)).toBeTrue()
            expect(v.isValid(2)).toBeTrue()
            expect(v.isValid(3)).toBeTrue()
            expect(v.isValid(undefined)).toBeFalse()
            expect(v.isValid(null)).toBeFalse()
            expect(v.validate(4)).toEqual([
                {
                    message: 'Expected: one of: 1 | 2 | 3, but was: 4. At: ',
                    path: [],
                },
            ])

            const notRequired: Validator<Maybe<1 | 2 | 3>> = v.maybe()
            expect(notRequired.isValid(3)).toBeTrue()
            expect(notRequired.isValid(null)).toBeTrue()
            expect(notRequired.isValid(4)).toBeFalse()
        })
    })

    describe('enumOf', () => {
        enum Color {
            RED = 'red',
            GREEN = 'green',
            BLUE = 'blue',
        }

        it('validates that an input is a value of the given enum', () => {
            const v: ValueSchema<Color> = enumOf(Color)
            expect(v.isValid('red')).toBeTrue()
            expect(v.isValid('green')).toBeTrue()
            expect(v.isValid('blue')).toBeTrue()
            expect(v.isValid('yellow')).toBeFalse()
            expect(v.isValid(null)).toBeFalse()
            expect(v.isValid(undefined)).toBeFalse()
        })
    })

    describe('exactlyNull', () => {
        it('validates that the input value is strictly null', () => {
            const v: Validator<null> = exactlyNull()
            v.assert(null)
            expect(v.validate(1)).toEqual([
                { message: 'Expected: null, but was: 1. At: ', path: [] },
            ])

            expect(v.validate(undefined)).toEqual([
                {
                    message: 'Expected: null, but was: undefined. At: ',
                    path: [],
                },
            ])
        })
    })

    describe('nullish', () => {
        it('validates that the input value is nullish', () => {
            const v: Validator<null | undefined> = nullish()
            v.assert(null)
            v.assert(undefined)
            v.assert(void 0)
            expect(v.validate(1)).toEqual([
                { message: 'Expected: nullish, but was: 1. At: ', path: [] },
            ])
        })
    })

    describe('number', () => {
        it('returns NumberSchema.base', () => {
            expect(number()).toBe(NumberSchema.base)
        })
    })

    describe('object', () => {
        it('returns ObjectSchema.base with properties', () => {
            expect(
                object({
                    a: number(),
                })
            ).toBeInstanceOf(ObjectSchema)
        })
    })

    describe('string', () => {
        it('returns StringSchema.base', () => {
            expect(string()).toBe(StringSchema.base)
        })
    })

    describe('symbol', () => {
        it('validates an input is a symbol', () => {
            const v: ValueSchema<symbol> = symbol()
            expect(v.isValid(Symbol('test'))).toBeTrue()
            expect(v.isValid(null)).toBeFalse()
            expect(v.isValid(undefined)).toBeFalse()
            expect(v.validate(false)).toEqual([
                {
                    message: 'Expected: type symbol, but was: false. At: ',
                    path: [],
                },
            ])

            const notRequired: Validator<Maybe<symbol>> = v.maybe()
            expect(notRequired.isValid(Symbol('test'))).toBeTrue()
            expect(notRequired.isValid(null)).toBeTrue()
        })
    })

    describe('exactlyUndefined', () => {
        it('validates that the input value is strictly undefined', () => {
            const v: Validator<undefined> = exactlyUndefined()
            expect(v.isValid(undefined)).toBeTrue()
            expect(v.isValid(null)).toBeFalse()
            expect(v.isValid(1)).toBeFalse()
        })
    })

    describe('custom', () => {
        it('creates a custom validator with default inputStringify', () => {
            const v: ValueSchema<number> = custom(
                'positive number',
                (input): input is number =>
                    typeof input === 'number' && input > 0
            )
            expect(v.isValid(5)).toBeTrue()
            expect(v.isValid(-1)).toBeFalse()
            expect(v.validate('invalid')).toEqual([
                {
                    message:
                        'Expected: positive number, but was: "invalid". At: ',
                    path: [],
                },
            ])
        })
    })
})
