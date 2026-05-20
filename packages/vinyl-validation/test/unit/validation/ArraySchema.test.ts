/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Maybe } from '@amazon/vinyl-util'
import type { ArraySchema } from '@amazon/vinyl-validation'
import {
    array,
    isOneOf,
    tuple,
    createValidator,
    type Validator,
} from '@amazon/vinyl-validation'
import {
    expectNothing,
    expectTypeStrictlyEquals,
} from '@amazon/vinyl-util/browserTestUtil'
import objectContaining = jasmine.objectContaining

describe('ArraySchema', () => {
    describe('base', () => {
        it('asserts that the input is a nullish array', () => {
            const v: Validator<unknown[]> = array()
            expect(v.isValid(null)).toBeFalse()
            expect(v.isValid(undefined)).toBeFalse()
            expect(v.isValid([])).toBeTrue()
            expect(v.isValid([1, 2, 3])).toBeTrue()
            expect(v.validate({})).toEqual([
                {
                    message: 'Expected: array, but was: {}. At: ',
                    path: [],
                },
            ])
        })
    })

    describe('withElements', () => {
        it('asserts all elements match a validator', () => {
            const v: Validator<number[]> = array(
                createValidator('number', (input) => typeof input === 'number')
            )

            expect(v.isValid([1, 2, 3])).toBeTrue()
            expect(v.isValid(null)).toBeFalse()
            expect(v.isValid(undefined)).toBeFalse()
            expect(() => v.assert([0, 'test'])).toThrowError(
                'Expected: number, but was: "test". At: 1'
            )

            expect(
                v.validate([0, 'test'], undefined, ['pathA', 'pathB'])
            ).toEqual([
                objectContaining({
                    path: ['pathA', 'pathB', '1'],
                    message:
                        'Expected: number, but was: "test". At: pathA.pathB.1',
                }),
            ])
        })

        it('intersects element types', () => {
            const v: ArraySchema<(4 | 5)[]> = array()
                .withElements(
                    createValidator(
                        '3 | 4 | 5',
                        (input: unknown): input is 3 | 4 | 5 => {
                            return input === 3 || input === 4 || input === 5
                        }
                    )
                )
                .withElements(
                    createValidator(
                        '4 | 5 | 6',
                        (input: unknown): input is 4 | 5 | 6 => {
                            return input === 4 || input === 5 || input === 6
                        }
                    )
                )

            expect(v.isValid([4, 5, 5, 4])).toBeTrue()
            expect(v.isValid(null)).toBeFalse()
            expect(v.isValid(undefined)).toBeFalse()
            expect(() => v.assert([4, 5, 4, 5, 6])).toThrowError(
                'Expected: 3 | 4 | 5, but was: 6. At: 4'
            )
        })

        it('allows chaining', () => {
            const v: Validator<number[] | null> = array(
                createValidator<number>(
                    'number',
                    (input: unknown): input is number => {
                        return typeof input === 'number'
                    }
                )
            ).orNull()

            expect(v.isValid(null)).toBeTrue()
        })

        it('narrows the current element type', () => {
            const v: Validator<(4 | 5)[]> = array()
                .withElements(
                    createValidator<3 | 4 | 5>(
                        '3 | 4 | 5',
                        (input: unknown) => {
                            return input === 3 || input === 4 || input === 5
                        }
                    )
                )
                .withElements(
                    createValidator<4 | 5 | 6>(
                        '4 | 5 | 6',
                        (input: unknown) => {
                            return input === 4 || input === 5 || input === 6
                        }
                    )
                )
            expect(v.isValid([4, 5, 4, 4, 5])).toBeTrue()
            expect(v.isValid([])).toBeTrue()
            expect(v.isValid(null)).toBeFalse()
            expect(() => v.assert([4, 5, 3])).toThrowError(
                'Expected: 4 | 5 | 6, but was: 3. At: 2'
            )
        })

        describe('when options.all is true', () => {
            it('returns errors for all elements', () => {
                const v = array(
                    createValidator<3 | 4 | 5>(
                        '3 | 4 | 5',
                        (input: unknown) => {
                            return input === 3 || input === 4 || input === 5
                        }
                    )
                )
                expect(v.validate([3, 4, 5, 6, 7, 8], { all: true })).toEqual([
                    {
                        message: 'Expected: 3 | 4 | 5, but was: 6. At: 3',
                        path: ['3'],
                    },
                    {
                        message: 'Expected: 3 | 4 | 5, but was: 7. At: 4',
                        path: ['4'],
                    },
                    {
                        message: 'Expected: 3 | 4 | 5, but was: 8. At: 5',
                        path: ['5'],
                    },
                ])
            })
        })
    })

    describe('tuple', () => {
        it('validates that each validator matches the input array', () => {
            const v: Validator<[Maybe<3 | 4>, 5 | 6, 7 | 8]> = tuple(
                isOneOf<[3, 4]>(3, 4).maybe(),
                isOneOf(5, 6),
                isOneOf(7, 8)
            )

            expect(v.isValid(null)).toBeFalse()
            expect(v.isValid(undefined)).toBeFalse()
            expect(v.isValid([null, 5, 7])).toBeTrue()
            expect(v.isValid([3, 5, 7])).toBeTrue()
            expect(v.isValid([4, 6, 8])).toBeTrue()
            expect(v.validate([4, 6, 8, 3])).toEqual([
                {
                    message: 'Expected: exactly 3 elements, but was: 4. At: ',
                    path: [],
                },
            ])
            expect(v.validate([4, 6])).toEqual([
                {
                    message: 'Expected: exactly 3 elements, but was: 2. At: ',
                    path: [],
                },
            ])
            expect(v.validate([4, 6, 9])).toEqual([
                {
                    message: 'Expected: one of: 7 | 8, but was: 9. At: 2',
                    path: ['2'],
                },
            ])
        })

        describe('when options.all is true', () => {
            it('returns all validation errors', () => {
                const v: Validator<[number, string]> = tuple(
                    createValidator<number>(
                        'number',
                        (input) => typeof input === 'number'
                    ),
                    createValidator<string>(
                        'string',
                        (input) => typeof input === 'string'
                    )
                )
                expect(
                    v.validate(['test', 3, 3], { all: true }, ['a'])
                ).toEqual([
                    {
                        message:
                            'Expected: exactly 2 elements, but was: 3. At: a',
                        path: ['a'],
                    },
                    {
                        message: 'Expected: number, but was: "test". At: a.0',
                        path: ['a', '0'],
                    },
                    {
                        message: 'Expected: string, but was: 3. At: a.1',
                        path: ['a', '1'],
                    },
                ])
            })
        })
    })

    describe('readonly', () => {
        it('casts the validator as a readonly array', () => {
            const numberValidator = createValidator<number>(
                'number',
                (input) => typeof input === 'number'
            )
            const v: Validator<readonly number[]> = array()
                .withElements(numberValidator)
                .readonly()
            v.assert([1])

            const v2: Validator<readonly number[]> = array()
                .withElements(numberValidator)
                .readonly()
            v2.assert([1])
            expectNothing()
        })
    })

    describe('minLength', () => {
        it('asserts the input is at least the given length', () => {
            const v: Validator<unknown[]> = array().minLength(3)

            expect(v.isValid(null)).toBeFalse()
            expect(v.isValid([0, 1, 2])).toBeTrue()
            expect(v.isValid([0, 1, 2, 3])).toBeTrue()

            expect(v.validate([0])).toEqual([
                {
                    message:
                        'Expected: at least 3 elements, but was: length 1. At: ',
                    path: [],
                },
            ])
        })
    })

    describe('maxLength', () => {
        it('asserts the input is at most the given length', () => {
            const v: Validator<unknown[]> = array().maxLength(5)

            expect(v.isValid(null)).toBeFalse()
            expect(v.isValid([0, 1, 2, 4])).toBeTrue()
            expect(v.isValid([0, 1, 2, 4, 5])).toBeTrue()

            expect(v.validate([0, 1, 2, 4, 5, 6])).toEqual([
                {
                    message:
                        'Expected: at most 5 elements, but was: length 6. At: ',
                    path: [],
                },
            ])
        })
    })

    describe('cast', () => {
        it('casts the type parameter', () => {
            const _v = array().cast<number[]>()
            expectTypeStrictlyEquals<typeof _v, ArraySchema<number[]>>(true)
        })
    })
})
