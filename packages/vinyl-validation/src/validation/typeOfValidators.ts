/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FromTypeof, Typeof } from '@amazon/vinyl-util'
import { substitute } from '@amazon/vinyl-util'
import type { Validator } from './Validator'
import { createValidator } from './Validator'
import type { JsonSchema, JsonSchemaType } from './JsonSchema'

/**
 * @private
 */
const locale = {
    template: 'type {value}',
} as const

/**
 * The JSON Schema `type` for each JavaScript `typeof` value that has a JSON representation.
 * Types with no JSON equivalent (`function`, `symbol`) are absent and contribute no fragment.
 */
const jsonSchemaTypeByTypeof: Partial<Record<Typeof, JsonSchemaType>> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    object: 'object',
}

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
    const jsonType = jsonSchemaTypeByTypeof[expected]
    const jsonSchema: JsonSchema | undefined =
        jsonType == null ? undefined : { type: jsonType }
    return createValidator(
        substitute(locale.template, { value: expected }),
        (input: unknown): input is NonNullable<FromTypeof<T>> => {
            return input != null && typeof input === expected
        },
        undefined,
        jsonSchema
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
