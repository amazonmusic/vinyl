/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FromTypeof, Typeof } from '@amazon/vinyl-util'
import { substitute } from '@amazon/vinyl-util'
import type { Validator } from './Validator'
import { createValidator } from './Validator'

/**
 * @private
 */
const locale = {
    template: 'type {value}',
} as const

/**
 * Creates a validator that validates that the input is not nullish and its `typeof` matches the
 * expected value.
 *
 * Note: while `typeof null === 'object'`, `typeOfValidator('object')` will assert that its
 * input is not nullish.
 *
 * @param expected
 */
function typeOfValidator<T extends Typeof>(
    expected: T
): Validator<NonNullable<FromTypeof<T>>> {
    return createValidator(
        substitute(locale.template, { value: expected }),
        (input: unknown): input is NonNullable<FromTypeof<T>> => {
            return input != null && typeof input === expected
        }
    )
}

const typeOfValidatorCache: any = {}

function cachedTypeOfValidator<T extends Typeof>(
    type: T
): Validator<NonNullable<FromTypeof<T>>> {
    if (!(type in typeOfValidatorCache)) {
        typeOfValidatorCache[type] = typeOfValidator(type)
    }
    return typeOfValidatorCache[type]
}

/**
 * Validators asserting typeof input matches the expected value.
 *
 * Note: bigint is omitted; not all supported platforms can use BigInt.
 */
export const typeOfValidators = {
    get boolean() {
        return cachedTypeOfValidator('boolean')
    },
    get func() {
        return cachedTypeOfValidator('function')
    },
    get number() {
        return cachedTypeOfValidator('number')
    },
    get object() {
        return cachedTypeOfValidator('object')
    },
    get string() {
        return cachedTypeOfValidator('string')
    },
    get symbol() {
        return cachedTypeOfValidator('symbol')
    },
} as const
