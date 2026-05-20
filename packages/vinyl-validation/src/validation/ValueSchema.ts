/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { andValidators } from './andValidators'
import { orValidators } from './orValidators'
import { SchemaBase } from './SchemaBase'
import type { Validator } from './Validator'
import { createValidator } from './Validator'

const locale = {
    null: 'null',
    nullish: 'nullish',
    undefined: 'undefined',
} as const

export const valueValidators = {
    any(): Validator<any> {
        // no need for localization, validator cannot fail.
        return createValidator('', () => true)
    },

    /**
     * Creates a validator that asserts that the input is nullish.
     */
    nullish(): Validator<null | undefined> {
        return createValidator(locale.nullish, (input) => input == null)
    },

    /**
     * Creates a validator that asserts that the input is strictly null.
     */
    null(): Validator<null> {
        return createValidator(locale.null, (input) => input === null)
    },

    /**
     * Creates a validator that asserts that the input is strictly undefined.
     */
    undefined(): Validator<undefined> {
        return createValidator(locale.undefined, (input) => input === undefined)
    },
} as const

export class ValueSchema<T> extends SchemaBase<T> {
    /**
     * Prepends this validator allowing for null or undefined.
     */
    maybe(): ValueSchema<T | undefined | null> {
        return this.or(valueValidators.nullish())
    }

    /**
     * Prepends this validator allowing for null.
     */
    orNull(): ValueSchema<T | null> {
        return this.or(valueValidators.null())
    }

    /**
     * Prepends this validator allowing for undefined.
     */
    orUndefined(): ValueSchema<T | undefined> {
        return this.or(valueValidators.undefined())
    }

    /**
     * Returns a validator that asserts if this validator and the next passes.
     *
     * @see andValidators
     *
     * @param nextValidator The validator to run after the current.
     * @return Returns a new ValueSchema intersecting this validator and the next.
     */
    and<U>(nextValidator: Validator<U>): ValueSchema<T & U> {
        return new ValueSchema(nextValidator, this, andValidators)
    }

    /**
     * Returns a validator that asserts if this validator or the next passes.
     *
     * Implementation note:
     * subclasses should not change the schema instance returned unless all chainable validators
     * accept input type 'unknown'.
     *
     * @param nextValidator The validator to run after the current.
     * @return Returns a new ValueSchema providing the union of this validator and the next.
     */
    or<U>(nextValidator: Validator<U, any>): ValueSchema<T | U> {
        return new ValueSchema(nextValidator, this, orValidators)
    }
}
