/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Validator } from '@amazon/vinyl-validation'
import {
    createDeepValidator,
    createValidator,
    type ValidationErrorMessage,
} from '@amazon/vinyl-validation'
import { ErrorOrigin, ValidationError } from '@amazon/vinyl-util'
import { expectTypeExtends } from '@amazon/vinyl-util/browserTestUtil'
import objectContaining = jasmine.objectContaining

describe('Validator', () => {
    describe('createValidator', () => {
        describe('assert', () => {
            it('sets the origin on the validation error', () => {
                const v: Validator<any> = createValidator(
                    'message',
                    (_: unknown) => false
                )
                expect(() => v.assert(null)).toThrowMatching(
                    (e) =>
                        e instanceof ValidationError &&
                        e.origin === ErrorOrigin.API
                )
                expect(() =>
                    v.assert(null, ErrorOrigin.INTERNAL)
                ).toThrowMatching(
                    (e) =>
                        e instanceof ValidationError &&
                        e.origin === ErrorOrigin.INTERNAL
                )
            })

            it('fails if the validate method returns false', () => {
                const validator: Validator<1> = createValidator(
                    '1',
                    (input): input is 1 => input === 1
                )
                validator.assert(1)
                expect(() => validator.assert(2)).toThrowError(
                    'Expected: 1, but was: 2. At: '
                )
            })

            it('includes the path in the message', () => {
                const validator: Validator<never> = createValidator(
                    'never',
                    (_) => false
                )
                expect(() =>
                    validator.assert(2, ErrorOrigin.API, ['a', 'b', 'c'])
                ).toThrowError('Expected: never, but was: 2. At: a.b.c')
            })
        })

        describe('when actualMessage is provided', () => {
            it('uses the actualMessage string instead of a stringified input in the error message', () => {
                const validator: Validator<never> = createValidator(
                    'never',
                    (_) => false,
                    (input) => `not ${input}`
                )
                expect(() => validator.assert(2, ErrorOrigin.API)).toThrowError(
                    'Expected: never, but was: not 2. At: '
                )
            })
        })

        describe('isValid', () => {
            it('returns true if the validator test passes', () => {
                const v = createValidator<number, number>(
                    'test',
                    (input) => input > 3
                )
                expect(v.isValid(4)).toBeTrue()
                expect(v.isValid(3)).toBeFalse()
            })
        })

        describe('validate', () => {
            it('returns an array of errors', () => {
                const v = createValidator<number, number>(
                    'test',
                    (input) => input > 3
                )
                expect(v.validate(4)).toEqual([])
                expect(v.validate(3, undefined, ['a'])).toEqual([
                    {
                        message: 'Expected: test, but was: 3. At: a',
                        path: ['a'],
                    },
                ])
            })
        })
    })

    describe('createDeepValidator', () => {
        let validator: Validator<'b', string>

        beforeEach(() => {
            const validatorA: Validator<'a' | 'b', string> = createValidator(
                'a | b',
                (input) => input === 'a' || input === 'b'
            )
            const validatorB: Validator<'b' | 'c', string> = createValidator(
                'b | c',
                (input) => input === 'b' || input === 'c'
            )
            validator = createDeepValidator<'b', string>(
                'description',
                (input, options, path) => {
                    if (input === 'expected') return []
                    const errors: ValidationErrorMessage[] = []
                    errors.push(
                        ...validatorA.validate(input, options, path.concat('a'))
                    )
                    if (errors.length && !options.all) return errors
                    errors.push(
                        ...validatorB.validate(input, options, path.concat('b'))
                    )
                    return errors
                }
            )
        })

        it('creates a validator using the provided validate method', () => {
            expect(validator.isValid('b')).toBeTrue()
            expect(validator.isValid('c')).toBeFalse()
            expect(validator.validate('b')).toEqual([])
            expect(() => validator.assert('c')).toThrowError(
                'Expected: a | b, but was: "c". At: a'
            )
            expect(() =>
                validator.assert('a', ErrorOrigin.PARSING, ['z'])
            ).toThrowMatching((e) => {
                expect(e).toEqual(
                    objectContaining({
                        message: 'Expected: b | c, but was: "a". At: z.b',
                        path: ['z', 'b'],
                        origin: ErrorOrigin.PARSING,
                    })
                )
                expect(e).toBeInstanceOf(ValidationError)
                return true
            })
        })

        describe('when options is not defined', () => {
            it('defaults options.all to false', () => {
                expect(validator.validate('a', undefined, ['z'])).toEqual([
                    {
                        message: 'Expected: b | c, but was: "a". At: z.b',
                        path: ['z', 'b'],
                    },
                ])
            })
        })

        describe('when options is defined', () => {
            it('provides options to the validator', () => {
                expect(validator.validate('z', {}, ['z'])).toEqual([
                    {
                        message: 'Expected: a | b, but was: "z". At: z.a',
                        path: ['z', 'a'],
                    },
                ])

                expect(validator.validate('z', { all: true }, ['z'])).toEqual([
                    {
                        message: 'Expected: a | b, but was: "z". At: z.a',
                        path: ['z', 'a'],
                    },
                    {
                        message: 'Expected: b | c, but was: "z". At: z.b',
                        path: ['z', 'b'],
                    },
                ])
            })
        })
    })

    it('is invariant on T', () => {
        type S = {
            a: number
        }
        type T = S & {
            b?: number
        }
        expectTypeExtends<Validator<S>, Validator<T>>(false)
        expectTypeExtends<Validator<T>, Validator<S>>(false)
        expectTypeExtends<Validator<T>, Validator<T>>(true)
    })
})
