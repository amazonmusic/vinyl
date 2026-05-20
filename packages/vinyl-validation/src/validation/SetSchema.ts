/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SetElementType } from '@amazon/vinyl-util'
import { substitute } from '@amazon/vinyl-util'
import type { ValidationErrorMessage, Validator } from './Validator'
import { createDeepValidator, createValidator } from './Validator'
import { ValueSchema } from './ValueSchema'

/**
 * @private
 */
const locale = {
    set: 'Set',
    withElements: 'Set<{value}>',
} as const

export const setValidators = {
    /**
     * Creates a validator that asserts that the input is a set.
     */
    isSet(): Validator<Set<unknown>> {
        return createValidator(
            locale.set,
            (input: unknown) => input instanceof Set
        )
    },

    /**
     * Creates a validator that asserts that every element passes the given validator.
     *
     * @param elementValidator
     */
    withElements<U>(
        elementValidator: Validator<U>
    ): Validator<Set<U>, ReadonlySet<unknown>> {
        return createDeepValidator(
            substitute(locale.withElements, {
                value: elementValidator.description,
            }),
            (input, options, path) => {
                const errors: ValidationErrorMessage[] = []
                let i = 0
                for (const element of input) {
                    errors.push(
                        ...elementValidator.validate(
                            element,
                            options,
                            path.concat(i.toString())
                        )
                    )
                    if (!options.all && errors.length) return errors
                    i++
                }
                return errors
            }
        )
    },
} as const

export class SetSchema<T extends ReadonlySet<unknown>> extends ValueSchema<T> {
    private static _base: SetSchema<Set<unknown>> | null = null

    /**
     * The base SetSchema instance validating that the input is a Set.
     */
    static get base(): SetSchema<Set<unknown>> {
        if (this._base == null)
            this._base = new SetSchema(setValidators.isSet())
        return this._base
    }

    /**
     * Creates a validator that asserts that every element passes the given validator.
     *
     * @param elementValidator
     */
    withElements<U>(
        elementValidator: Validator<U>
    ): SetSchema<Set<SetElementType<T> & U>> {
        return this.chain(setValidators.withElements(elementValidator))
    }

    /**
     * Casts to a readonly set.
     * This is a shallow cast, elements of the array will not be changed.
     */
    readonly(): SetSchema<ReadonlySet<SetElementType<T>>> {
        return this as any
    }

    /**
     * Casts the parameter type.
     */
    cast<T extends ReadonlySet<unknown>>(): SetSchema<T> {
        return this as any
    }
}
