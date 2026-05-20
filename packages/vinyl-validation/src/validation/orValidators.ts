/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { substitute } from '@amazon/vinyl-util'
import type { ValidationErrorMessage, Validator } from './Validator'
import {
    createDeepValidator,
    createValidationExpectationMessage,
} from './Validator'

/*
 * @brief
 * orValidators will union an arbitrary number of validators.
 * input type is always type any; it's not strictly necessary for all validators to accept the same
 * input type. For example, if validatorA asserts that a value is not null, validatorB can safely
 * assume its input is not null.
 * output type will be the union of the validator outputs up to 5 validators, 6 or more will be
 * type any.
 */

/**
 * @private
 */
const locale = {
    /**
     * {value} - The child validators' descriptions, joined with `separator`.
     */
    template: '({value})',

    /**
     * The separator with which to join child validator descriptions.
     */
    separator: ' | ',
} as const

/**
 * Validates that one of the given validators pass.
 */
export function orValidators<A, B>(
    validatorA: Validator<A, any>,
    validatorB: Validator<B, any>
): Validator<A | B, any>

/**
 * Validates that one of the given validators pass.
 */
export function orValidators<A, B, C>(
    validatorA: Validator<A, any>,
    validatorB: Validator<B, any>,
    validatorC: Validator<C, any>
): Validator<A | B | C, any>

/**
 * Validates that one of the given validators pass.
 */
export function orValidators<A, B, C, D>(
    validatorA: Validator<A, any>,
    validatorB: Validator<B, any>,
    validatorC: Validator<C, any>,
    validatorD: Validator<D, any>
): Validator<A | B | C | D, any>

/**
 * Validates that one of the given validators pass.
 */
export function orValidators<A, B, C, D, E>(
    validatorA: Validator<A, any>,
    validatorB: Validator<B, any>,
    validatorC: Validator<C, any>,
    validatorD: Validator<D, any>,
    validatorE: Validator<E, any>
): Validator<A | B | C | D | E, any>

export function orValidators(
    ...validators: Validator<any, any>[]
): Validator<any, any>

/**
 * Validates that one of the given validators pass.
 *
 * If all validators fail, the validator that produced an error at the deepest path will have its
 * error message bubbled. If all validators failed at the current depth, a concatenation of
 * validator descriptions will be used.
 *
 * For example:
 * `orValidators(number(), string()).validate(false)` will produce the message:
 * 'Expected (number | string), but was false, At: '
 *
 * And:
 * `orValidators(number(), object({ childProp: number() })).validate({ childProp: 'not-a-number' })`
 * will produce:
 * 'Expected number, but was "not-a-number", At: childProp'
 *
 * @param validators The validators to test.
 */
export function orValidators(
    ...validators: Validator<any, any>[]
): Validator<any, any> {
    const description = substitute(locale.template, {
        value: validators.map((v) => v.description).join(locale.separator),
    })

    return createDeepValidator(description, (input, options, path) => {
        let longestErrors: readonly ValidationErrorMessage[] = []
        let longestPath = 0
        for (const validator of validators) {
            const errors = validator.validate(input, options, path)
            if (!errors.length) return errors
            // Take the deepest error to bubble.
            const pathLength = errors.reduce(
                (max, m) => Math.max(m.path.length, max),
                0
            )
            if (pathLength >= longestPath) {
                longestErrors = errors
                longestPath = pathLength
            }
        }
        return longestPath > path.length
            ? longestErrors
            : [
                  {
                      message: createValidationExpectationMessage(
                          description,
                          input,
                          path
                      ),
                      path,
                  },
              ]
    })
}
