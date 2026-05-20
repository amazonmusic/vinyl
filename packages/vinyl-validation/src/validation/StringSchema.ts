/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { substitute } from '@amazon/vinyl-util'
import { ValueSchema } from './ValueSchema'
import { typeOfValidators } from './typeOfValidators'
import type { Validator } from './Validator'
import { createValidator } from './Validator'

/**
 * @private
 */
const locale = {
    notEmpty: 'not empty',
    minLength: 'at least {value} characters',
    maxLength: 'at most {value} characters',
    noWhitespace: 'no whitespace characters',
    matches: 'matches {value}',
} as const

export const stringValidators = {
    /**
     * Creates a validator that asserts that the input is not empty.
     */
    notEmpty(): Validator<string, string> {
        return createValidator(locale.notEmpty, (input) => input !== '')
    },

    /**
     * Creates a validator that asserts that the input string has at least the given minimum
     * length.
     *
     * @param min The string must be at least this length.
     */
    minLength(min: number): Validator<string, string> {
        return createValidator(
            substitute(locale.minLength, { value: min }),
            (input) => input.length >= min
        )
    },

    /**
     * Creates a validator that asserts that the input string has at most the given maximum
     * length.
     *
     * @param max The string must be at most this length.
     */
    maxLength(max: number): Validator<string, string> {
        return createValidator(
            substitute(locale.maxLength, { value: max }),
            (input) => input.length <= max
        )
    },

    /**
     * Creates a validator that asserts that the input string has no whitespace characters.
     * Whitespace characters include space, new line, carriage return, and tab.
     */
    noWhitespace(): Validator<string, string> {
        return createValidator(
            locale.noWhitespace,
            (input) => input.search(/\s/g) === -1
        )
    },

    /**
     * Creates a validator that asserts that the input string matches the given regex.
     * @param regex
     */
    matches(regex: RegExp): Validator<string, string> {
        return createValidator(
            substitute(locale.matches, { value: regex.toString() }),
            (input) => {
                return regex.test(input)
            }
        )
    },
} as const

export class StringSchema extends ValueSchema<string> {
    private static _base: StringSchema | null = null

    /**
     * The base SetSchema instance validating that the input is a Set.
     */
    static get base(): StringSchema {
        if (this._base == null)
            this._base = new StringSchema(typeOfValidators.string)
        return this._base
    }

    /**
     * Creates a validator that asserts that the input is not empty.
     */
    notEmpty(): StringSchema {
        return this.chain(stringValidators.notEmpty())
    }

    /**
     * Creates a validator that asserts that the input string has at least the given minimum
     * length.
     *
     * @param min The string must be at least this length.
     */
    minLength(min: number): StringSchema {
        return this.chain(stringValidators.minLength(min))
    }

    /**
     * Creates a validator that asserts that the input string has at most the given maximum
     * length.
     *
     * @param max The string must be at most this length.
     */
    maxLength(max: number): StringSchema {
        return this.chain(stringValidators.maxLength(max))
    }

    /**
     * Creates a validator that asserts that the input string has no whitespace characters.
     * Whitespace characters include space, new line, carriage return, and tab.
     */
    noWhitespace(): StringSchema {
        return this.chain(stringValidators.noWhitespace())
    }

    /**
     * Creates a validator that asserts that the input string matches the given regex.
     * @param regex
     */
    matches(regex: RegExp): StringSchema {
        return this.chain(stringValidators.matches(regex))
    }
}
