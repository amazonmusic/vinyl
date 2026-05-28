/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Fun } from '@amazon/vinyl-util'
import { substitute } from '@amazon/vinyl-util'
import { ValueSchema } from './ValueSchema'
import type { Validator } from './Validator'
import { createValidator } from './Validator'
import { typeOfValidators } from './typeOfValidators'

/**
 * @private
 */
const locale = {
    length: 'at most {value} arguments',
    actualLength: '{value} arguments',
} as const

export const functionValidators = {
    length(max: number): Validator<Fun, Fun> {
        return createValidator(
            substitute(locale.length, { value: max }),
            (input) => input.length <= max,
            (input) => substitute(locale.actualLength, { value: input.length })
        )
    },
} as const

export class FunctionSchema<T extends Fun> extends ValueSchema<T> {
    private static _base: FunctionSchema<Fun> | null = null

    /**
     * The base Function validator validating that the input is a function.
     */
    static get base(): FunctionSchema<Fun> {
        if (this._base == null)
            this._base = new FunctionSchema(typeOfValidators.func)
        return this._base
    }

    length(max: number): FunctionSchema<T> {
        return this.chain(functionValidators.length(max))
    }

    /**
     * Casts the function signature.
     * Function signatures, except for their required number of parameters, cannot be
     * meaningfully validated.
     */
    cast<T extends Fun>(): FunctionSchema<T> {
        return this as any
    }
}
