/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ElementType } from '@amazon/vinyl-util'
import { substitute } from '@amazon/vinyl-util'
import { ValueSchema } from './ValueSchema'
import type { ValidationErrorMessage, Validator } from './Validator'
import { createDeepValidator, createValidator } from './Validator'

/**
 * @private
 */
const locale = {
    array: 'array',
    minLength: 'at least {value} elements',
    maxLength: 'at most {value} elements',
    exactlyLength: 'exactly {value} elements',
    actualLength: 'length {value}',
    withElements: '({value})[]',
    tuple: '[{value}]',
} as const

export const arrayValidators = {
    /**
     * Creates a validator that asserts that the input is an array.
     *
     * Note: arrays can only be readonly by type system, there is no native readonly
     * js array. This validator assumes mutability, use the ArraySchema readonly() method
     * to cast to a readonly array.
     */
    isArray(): Validator<unknown[]> {
        return createValidator(locale.array, (input: unknown) =>
            Array.isArray(input)
        )
    },

    /**
     * Creates a validator that asserts that every element passes the given validator.
     *
     * @param elementValidator
     */
    withElements<U>(
        elementValidator: Validator<U>
    ): Validator<U[], readonly unknown[]> {
        return createDeepValidator(
            substitute(locale.withElements, {
                value: elementValidator.description,
            }),
            (input, options, path) => {
                const errors: ValidationErrorMessage[] = []
                for (let i = 0; i < input.length; i++) {
                    const element = input[i]
                    errors.push(
                        ...elementValidator.validate(
                            element,
                            options,
                            path.concat(i.toString())
                        )
                    )
                    if (!options.all && errors.length) return errors
                }
                return errors
            }
        )
    },

    /**
     * Creates a validator that asserts that the input array is a tuple whose elements match
     * the given validators.
     *
     * @param validators
     */
    tuple<U extends readonly any[]>(
        ...validators: {
            [Index in keyof U]: Validator<U[Index]>
        }
    ): Validator<
        {
            [Index in keyof U]: U[Index]
        },
        readonly unknown[]
    > {
        const lengthValidator = createValidator(
            substitute(locale.exactlyLength, {
                value: validators.length,
            }),
            (length: number) => length === validators.length
        )
        return createDeepValidator(
            substitute(locale.tuple, { value: validators.join(', ') }),
            (input, options, path) => {
                const errors: ValidationErrorMessage[] = []
                errors.push(
                    ...lengthValidator.validate(input.length, options, path)
                )
                if (!options.all && errors.length) return errors
                const n = Math.min(validators.length, input.length)
                for (let i = 0; i < n; i++) {
                    const element = input[i]
                    const validator = validators[i]
                    errors.push(
                        ...validator.validate(
                            element,
                            options,
                            path.concat(i.toString())
                        )
                    )
                    if (!options.all && errors.length) return errors
                }
                return errors
            }
        )
    },

    /**
     * Creates a validator that validates the input array has the given minimum length.
     * @param min The minimum number of elements (inclusive)
     */
    minLength(min: number): Validator<readonly unknown[], readonly unknown[]> {
        return createValidator(
            substitute(locale.minLength, { value: min }),
            (input) => input.length >= min,
            (input) => substitute(locale.actualLength, { value: input.length })
        )
    },

    /**
     *
     * Creates a validator that validates the input array has the given maximum length.
     * @param max The maximum number of elements (inclusive)
     */
    maxLength(max: number): Validator<readonly unknown[], readonly unknown[]> {
        return createValidator(
            substitute(locale.maxLength, { value: max }),
            (input) => input.length <= max,
            (input) => substitute(locale.actualLength, { value: input.length })
        )
    },
} as const

export class ArraySchema<T extends readonly unknown[]> extends ValueSchema<T> {
    private static _base: ArraySchema<unknown[]> | null = null

    /**
     * The base ArraySchema instance validating that the input is an Array.
     */
    static get base(): ArraySchema<unknown[]> {
        if (this._base == null)
            this._base = new ArraySchema(arrayValidators.isArray())
        return this._base
    }

    /**
     * Creates a validator that asserts that every element passes the given validator.
     *
     * @param elementValidator
     */
    withElements<U>(
        elementValidator: Validator<U>
    ): ArraySchema<(ElementType<T> & U)[]> {
        return this.chain(arrayValidators.withElements(elementValidator))
    }

    /**
     * Creates a validator that asserts that the input array is a tuple whose elements match
     * the given validators.
     *
     * @param validators
     */
    tuple<U extends readonly any[]>(
        ...validators: {
            [Index in keyof U]: Validator<U[Index]>
        }
    ): ArraySchema<{
        [Index in keyof U]: U[Index]
    }> {
        return this.chain(arrayValidators.tuple(...validators))
    }

    /**
     * Creates a validator that validates the input array has the given minimum length.
     * @param min The minimum number of elements (inclusive)
     */
    minLength(min: number): ArraySchema<T> {
        return this.chain(arrayValidators.minLength(min))
    }

    /**
     *
     * Creates a validator that validates the input array has the given maximum length.
     * @param max The maximum number of elements (inclusive)
     */
    maxLength(max: number): ArraySchema<T> {
        return this.chain(arrayValidators.maxLength(max))
    }

    /**
     * Casts to a readonly array.
     * This is a shallow cast, elements of the array will not be changed.
     */
    readonly(): ArraySchema<Readonly<T>> {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        return this as any
    }

    /**
     * Casts the type parameter.
     */
    cast<T extends readonly unknown[]>(): ArraySchema<T> {
        return this as any
    }
}
