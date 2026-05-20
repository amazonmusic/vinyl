/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Validator } from '@amazon/vinyl-validation'
import {
    createValidator,
    ValueSchema,
    valueValidators,
} from '@amazon/vinyl-validation'
import { expectTypeStrictlyEquals } from '@amazon/vinyl-util/browserTestUtil'
import { MockValidator } from './MockValidator'
import type { Maybe } from '@amazon/vinyl-util'

describe('valueValidators', () => {
    describe('null', () => {
        it('validates that the input value is strictly null', () => {
            const v: Validator<null> = valueValidators.null()
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
            const v: Validator<null | undefined> = valueValidators.nullish()
            v.assert(null)
            v.assert(undefined)
            v.assert(void 0)
            expect(v.validate(1)).toEqual([
                { message: 'Expected: nullish, but was: 1. At: ', path: [] },
            ])
        })
    })

    describe('undefined', () => {
        it('validates that the input value is strictly undefined', () => {
            const v: Validator<undefined> = valueValidators.undefined()
            v.assert(undefined)
            expect(v.validate(null)).toEqual([
                {
                    message: 'Expected: undefined, but was: null. At: ',
                    path: [],
                },
            ])
        })
    })
})

describe('ValueSchema', () => {
    const isThree: ValueSchema<3> = new ValueSchema(
        createValidator('3', (input: any) => {
            return input === 3
        })
    )

    describe('maybe', () => {
        it('considers current, undefined, or null to be valid', () => {
            const maybeThree: ValueSchema<Maybe<3>> = isThree.maybe()
            expect(maybeThree.isValid(3)).toBeTrue()
            expect(maybeThree.isValid(4)).toBeFalse()
            expect(maybeThree.isValid(null)).toBeTrue()
            expect(maybeThree.isValid(undefined)).toBeTrue()
        })
    })

    describe('orNull', () => {
        it('considers current or null to be valid', () => {
            const threeOrNull: ValueSchema<3 | null> = isThree.orNull()
            expect(threeOrNull.isValid(3)).toBeTrue()
            expect(threeOrNull.isValid(null)).toBeTrue()
            expect(threeOrNull.isValid(undefined)).toBeFalse()
        })
    })

    describe('orUndefined', () => {
        it('considers current or undefined to be valid', () => {
            const maybeThree: ValueSchema<3 | undefined> = isThree.orUndefined()
            expect(maybeThree.isValid(3)).toBeTrue()
            expect(maybeThree.isValid(4)).toBeFalse()
            expect(maybeThree.isValid(null)).toBeFalse()
            expect(maybeThree.isValid(undefined)).toBeTrue()
        })
    })

    const errorResult = [{ message: 'error', path: [] }] as const

    describe('and', () => {
        it('intersects self and the given validator', () => {
            const current = new MockValidator()
            const schema = new ValueSchema(current)
            const next = new MockValidator()
            const joined = schema.and(next)
            current.validate.and.returnValue([])
            next.validate.and.returnValue([])
            expect(joined.isValid(42)).toBeTrue()
            current.validate.and.returnValue(errorResult)
            expect(joined.isValid(42)).toBeFalse()
            current.validate.and.returnValue([])
            next.validate.and.returnValue(errorResult)
            expect(joined.isValid(42)).toBeFalse()
            current.validate.and.returnValue(errorResult)
            expect(joined.isValid(42)).toBeFalse()
        })

        it('returns an intersection type', () => {
            const schema: ValueSchema<number> = new ValueSchema<number>(
                new MockValidator()
            )
            const validator: Validator<string> = new MockValidator()
            const _union = schema.and(validator)
            expectTypeStrictlyEquals<
                typeof _union,
                ValueSchema<string & number>
            >(true)
        })
    })

    describe('or', () => {
        it('unions self and the given validator', () => {
            const current = new MockValidator()
            const schema = new ValueSchema(current)
            const next = new MockValidator()
            const joined = schema.or(next)
            current.validate.and.returnValue([])
            next.validate.and.returnValue([])
            expect(joined.isValid(42)).toBeTrue()
            current.validate.and.returnValue(errorResult)
            expect(joined.isValid(42)).toBeTrue()
            current.validate.and.returnValue([])
            next.validate.and.returnValue(errorResult)
            expect(joined.isValid(42)).toBeTrue()
            current.validate.and.returnValue(errorResult)
            expect(joined.isValid(42)).toBeFalse()
        })

        it('returns a union type', () => {
            const schema: ValueSchema<number> = new ValueSchema(
                new MockValidator()
            )
            const validator: Validator<string> = new MockValidator()
            const _union = schema.or(validator)
            expectTypeStrictlyEquals<
                typeof _union,
                ValueSchema<string | number>
            >(true)
        })
    })
})
