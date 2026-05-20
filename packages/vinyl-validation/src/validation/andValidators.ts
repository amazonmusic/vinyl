/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { substitute } from '@amazon/vinyl-util'
import type { Validator } from './Validator'
import { createDeepValidator } from './Validator'

/*
 * @brief
 * andValidators will intersect an arbitrary number of validators.
 *
 * While in most cases validating that an input passes two validators, the asserted output is the
 * intersection of those two validator outputs, this is not always the case.
 * For example, take two validators with outputs `A[]` and `B[]`, their combined validated output
 * type would be `(A & B)[]`, not `A[] & B[]`. Use casting when necessary.
 *
 * Also note that there is no contravariance safety with the chained validator inputs. That is,
 * there's no compile-time checking that validatorB accepts an input that is the super of
 *  validatorA's output.
 */

/**
 * @private
 */
const locale = {
    /**
     * {value} The child validators' descriptions, joined with `separator`.
     *
     * groupings of and validators is unimportant,
     * and(and(a, b), c) is the same as and(a, and(b, c)), so `a & b & c` is an accurate
     * representation for either.
     */
    template: '{value}',

    /**
     * The separator with which to join child validator descriptions.
     */
    separator: ' & ',
} as const

/**
 * Validates that all the given validators pass.
 */
export function andValidators<A extends Input, B, Input>(
    validatorA: Validator<A, Input>,
    validatorB: Validator<B, any>
): Validator<A & B, Input>

/**
 * Validates that all the given validators pass.
 */
export function andValidators<A extends Input, B, C, Input>(
    validatorA: Validator<A, Input>,
    validatorB: Validator<B, any>,
    validatorC: Validator<C, any>
): Validator<A & B & C, Input>

/**
 * Validates that all the given validators pass.
 */
export function andValidators<A extends Input, B, C, D, Input>(
    validatorA: Validator<A, Input>,
    validatorB: Validator<B, any>,
    validatorC: Validator<C, any>,
    validatorD: Validator<D, any>
): Validator<A & B & C & D, any>

/**
 * Validates that all the given validators pass.
 */
export function andValidators<A extends Input, B, C, D, E, Input>(
    validatorA: Validator<A, Input>,
    validatorB: Validator<B, any>,
    validatorC: Validator<C, any>,
    validatorD: Validator<D, any>,
    validatorE: Validator<E, any>
): Validator<A & B & C & D & E, any>

export function andValidators(
    ...validators: Validator<any, any>[]
): Validator<any, any>

export function andValidators(
    ...validators: Validator<any, any>[]
): Validator<any, any> {
    return createDeepValidator(
        substitute(locale.template, {
            value: validators.map((v) => v.description).join(locale.separator),
        }),
        (input, options, path) => {
            for (const validator of validators) {
                const errors = validator.validate(input, options, path)
                if (errors.length) return errors
            }
            return []
        }
    )
}
