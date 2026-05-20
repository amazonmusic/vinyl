/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { substitute } from '@amazon/vinyl-util'
import { ValueSchema } from './ValueSchema'
import { typeOfValidators } from './typeOfValidators'
import type { Validator } from './Validator'
import { createValidator } from './Validator'

const locale = {
    gte: 'at least {value}',
    gt: 'greater than {value}',
    lte: 'at most {value}',
    lt: 'less than {value}',
    within: 'within {min} and {max}',
    safeInteger: 'safe integer',
    finite: 'finite',
} as const

export const numberValidators = {
    /**
     * Creates a validator that asserts that the input number is at least the provided minimum
     * value.
     *
     * @param min The minimum (inclusive) the value may be.
     */
    gte(min: number): Validator<number, number> {
        return createValidator(
            substitute(locale.gte, { value: min }),
            (input) => input >= min
        )
    },

    /**
     * Creates a validator that asserts that the input number is greater than the provided minimum
     * value.
     *
     * @param min The minimum (exclusive) the value may be.
     */
    gt(min: number): Validator<number, number> {
        return createValidator(
            substitute(locale.gt, { value: min }),
            (input) => input > min
        )
    },

    /**
     * Creates a validator that asserts that the input number is at most the provided maximum
     * value.
     *
     * @param max The maximum (inclusive) the value may be.
     */
    lte(max: number): Validator<number, number> {
        return createValidator(
            substitute(locale.lte, { value: max }),
            (input) => input <= max
        )
    },

    /**
     * Creates a validator that asserts that the input number is less than the provided maximum
     * value.
     *
     * @param max The maximum (exclusive) the value may be.
     */
    lt(max: number): Validator<number, number> {
        return createValidator(
            substitute(locale.lt, { value: max }),
            (input) => input < max
        )
    },

    /**
     * Creates a validator that asserts that the input number is at least the provided minimum
     * and at most the provided maximum values.
     *
     * @param min The minimum (inclusive) value the input may be.
     * @param max The maximum (inclusive) value the input may be.
     */
    within(min: number, max: number): Validator<number, number> {
        return createValidator(
            substitute(locale.within, { min, max }),
            (input) => input >= min && input <= max
        )
    },

    /**
     * Creates a validator that asserts that the input number is finite.
     */
    finite(): Validator<number, number> {
        return createValidator(locale.finite, (input) => Number.isFinite(input))
    },

    /**
     * Creates a validator that asserts that the input number is a safe integer.
     */
    safeInteger(): Validator<number, number> {
        return createValidator(locale.safeInteger, (input) =>
            Number.isSafeInteger(input)
        )
    },
} as const

export class NumberSchema extends ValueSchema<number> {
    private static _base: NumberSchema | null = null

    /**
     * The base Object validator validating that the input is an object.
     */
    static get base(): NumberSchema {
        if (this._base == null)
            this._base = new NumberSchema(typeOfValidators.number)
        return this._base
    }

    /**
     * Creates a validator that asserts that the input number is at least the provided minimum
     * value.
     *
     * @param min The minimum (inclusive) the value may be.
     */
    gte(min: number): this {
        return this.chain(numberValidators.gte(min))
    }

    /**
     * Creates a validator that asserts that the input number is greater than the provided minimum
     * value.
     *
     * @param min The minimum (exclusive) the value may be.
     */
    gt(min: number): this {
        return this.chain(numberValidators.gt(min))
    }

    /**
     * Creates a validator that asserts that the input number is at most the provided maximum
     * value.
     *
     * @param max The maximum (inclusive) the value may be.
     */
    lte(max: number): this {
        return this.chain(numberValidators.lte(max))
    }

    /**
     * Creates a validator that asserts that the input number is less than the provided maximum
     * value.
     *
     * @param max The maximum (exclusive) the value may be.
     */
    lt(max: number): this {
        return this.chain(numberValidators.lt(max))
    }

    /**
     * Creates a validator that asserts that the input number is at least the provided minimum
     * and at most the provided maximum values.
     *
     * @param min The minimum (inclusive) value the input may be.
     * @param max The maximum (inclusive) value the input may be.
     */
    within(min: number, max: number): this {
        return this.chain(numberValidators.within(min, max))
    }

    /**
     * Creates a validator that asserts that the input number is finite.
     */
    finite(): this {
        return this.chain(numberValidators.finite())
    }

    /**
     * Creates a validator that asserts that the input number is a safe integer.
     */
    safeInteger(): this {
        return this.chain(numberValidators.safeInteger())
    }
}
