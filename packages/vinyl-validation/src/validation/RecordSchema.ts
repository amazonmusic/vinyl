/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReadonlyRecord } from '@amazon/vinyl-util'
import { ownKeys, substitute } from '@amazon/vinyl-util'
import { ValueSchema } from './ValueSchema'
import { StringSchema } from './StringSchema'
import { typeOfValidators } from './typeOfValidators'
import type { ValidationErrorMessage, Validator } from './Validator'
import { createDeepValidator } from './Validator'

/**
 * @private
 */
const locale = {
    record: '{ [key: {key}]: {value} }',
} as const

export const recordValidators = {
    /**
     * Returns a validator that asserts that the object's own enumerable properties has keys and
     * values that match their respective validators.
     *
     * Prototype members are not included.
     * Numeric keys are validated as strings. For example the object `{ [0]: 1 }` will be passed
     * to the key validator as '0'.
     *
     * @param keyValidator Validates each key.
     * @param valueValidator Validates each value.
     */
    record<K extends string | symbol, V>(
        keyValidator: Validator<K>,
        valueValidator: Validator<V>
    ): Validator<Record<K, V>, object> {
        return createDeepValidator(
            substitute(locale.record, {
                key: keyValidator.description,
                value: valueValidator.description,
            }),
            (input, options, path) => {
                const errors: ValidationErrorMessage[] = []
                for (const key of ownKeys(input)) {
                    const keyStr = String(key)
                    errors.push(
                        ...keyValidator.validate(
                            key,
                            options,
                            path.concat(`[${keyStr}]`)
                        )
                    )
                    if (!options.all && errors.length) return errors
                    const value = input[key]
                    errors.push(
                        ...valueValidator.validate(
                            value,
                            options,
                            path.concat(keyStr)
                        )
                    )
                    if (!options.all && errors.length) return errors
                }
                return errors
            }
        )
    },
} as const

/**
 * Chainable object validators for the Record type.
 */
export class RecordSchema<
    T extends ReadonlyRecord<keyof any, any>,
> extends ValueSchema<T> {
    private static _base: RecordSchema<Record<keyof any, unknown>> | null = null

    /**
     * The base Object validator validating that the input is an object.
     */
    static get base(): RecordSchema<Record<keyof any, unknown>> {
        if (this._base == null)
            this._base = new RecordSchema(typeOfValidators.object)
        return this._base
    }

    private static get defaultKeyValidator(): StringSchema {
        return StringSchema.base
    }

    /**
     * Returns a validator that asserts that the object's own enumerable properties has keys and
     * values that match their respective validators.
     *
     * Prototype members are not included.
     * Numeric keys are validated as strings. For example the object `{ [0]: 1 }` will be passed
     * to the key validator as '0'.
     *
     * @param keyValidator Validates each key.
     * @param valueValidator Validates each value.
     */
    record<K extends string | symbol, V>(
        keyValidator: Validator<K>,
        valueValidator: Validator<V>
    ): RecordSchema<ReadonlyRecord<K, V>> {
        return this.chain(recordValidators.record(keyValidator, valueValidator))
    }

    /**
     * Returns a validator that asserts that the object's own enumerable properties has
     * string keys and values that match the given validator.
     *
     * Prototype members are not included.
     *
     * @param valueValidator Validates each value.
     */
    recordValues<V>(
        valueValidator: Validator<V>
    ): RecordSchema<Record<string, V>> {
        return this.record(RecordSchema.defaultKeyValidator, valueValidator)
    }

    /**
     * Casts to a ReadonlyRecord
     */
    readonly(): RecordSchema<
        T extends Record<infer K, infer V> ? ReadonlyRecord<K, V> : never
    > {
        return this as any
    }

    /**
     * Casts the type parameter.
     */
    cast<T extends ReadonlyRecord<keyof any, unknown>>(): RecordSchema<T> {
        return this as any
    }
}
