/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ValidationOptions } from '@amazon/vinyl-validation'
import { SchemaBase } from '@amazon/vinyl-validation'
import { MockValidator } from './MockValidator'
import { ErrorOrigin } from '@amazon/vinyl-util'
import { expectTypeEquals } from '@amazon/vinyl-util/browserTestUtil'

describe('SchemaBase', () => {
    const innerValidator = new MockValidator()

    class SchemaBaseTest<T = any> extends SchemaBase<T> {
        constructor() {
            super(innerValidator)
        }
    }

    let schema: SchemaBaseTest
    beforeEach(() => {
        schema = new SchemaBaseTest()
    })

    describe('isValid', () => {
        it('delegates to the validator', () => {
            innerValidator.isValid.and.returnValue(false)
            expect(schema.isValid('test')).toBeFalse()
            expect(innerValidator.isValid).toHaveBeenCalledOnceWith('test')
        })
    })

    describe('assert', () => {
        it('delegates to the validator', () => {
            innerValidator.assert.and.throwError('expected')
            expect(() =>
                schema.assert('test', ErrorOrigin.PARSING, ['a'])
            ).toThrowError('expected')
            expect(innerValidator.assert).toHaveBeenCalledOnceWith(
                'test',
                ErrorOrigin.PARSING,
                ['a']
            )
        })
    })

    describe('validate', () => {
        it('delegates to the validator', () => {
            innerValidator.validate.and.returnValue([
                { message: 'expected', path: ['a'] },
            ])
            const options: ValidationOptions = { all: true }
            expect(schema.validate(3, options, ['z'])).toEqual([
                { message: 'expected', path: ['a'] },
            ])
            expect(innerValidator.validate).toHaveBeenCalledOnceWith(
                3,
                options,
                ['z']
            )
        })
    })

    describe('self', () => {
        it('enforces this constructor has at most 3 required arguments', () => {
            class BadSchema extends SchemaBase<any> {
                constructor(_: 0, _1: 1, _2: 2, _3: 3) {
                    super(innerValidator)
                }

                fail() {
                    return this.self(innerValidator)
                }
            }

            const b = new BadSchema(0, 1, 2, 3)
            expect(() => b.fail()).toThrow()
        })
    })

    describe('optional', () => {
        it('returns a clone with options.optional true', () => {
            const optionalClone = schema.optional()
            expect(optionalClone).not.toBe(schema as any)
            const optionalOption = optionalClone.options.optional
            expect(optionalOption).toBeTrue()
            expectTypeEquals<typeof optionalOption, true>(true)
        })
    })

    describe('required', () => {
        it('returns a clone with options.optional false', () => {
            const optionalSchema = schema.optional()
            const requiredClone = optionalSchema.required()
            expect(requiredClone).not.toBe(schema as any)
            const optionalOption = requiredClone.options.optional
            expect(optionalOption).toBeFalse()
            expectTypeEquals<typeof optionalOption, false>(true)
        })
    })
})
