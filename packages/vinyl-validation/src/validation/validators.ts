/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type AnyRecord,
    type Fun,
    type Primitive,
    type ReadonlyRecord,
    stringifyForPrint,
    substitute,
} from '@amazon/vinyl-util'
import { ArraySchema } from './ArraySchema'
import { FunctionSchema } from './FunctionSchema'
import { SetSchema } from './SetSchema'
import { ValueSchema, valueValidators } from './ValueSchema'
import { NumberSchema } from './NumberSchema'
import { type ExtendedPropertyValidators, ObjectSchema } from './ObjectSchema'
import { RecordSchema } from './RecordSchema'
import { StringSchema } from './StringSchema'
import { typeOfValidators } from './typeOfValidators'
import type { Validator } from './Validator'
import { createValidator } from './Validator'

/**
 * @private
 */
const locale = {
    isOneOf: 'one of: {value}',
    instanceOf: 'instance of {value}',
    oneOfSeparator: ' | ',
} as const

/**
 * Creates a no-op validator. The value can be any type.
 */
export function any(): ValueSchema<any> {
    return new ValueSchema(valueValidators.any())
}

/**
 * Creates a validator that asserts that the input is an array.
 */
export function array(): ArraySchema<unknown[]>

/**
 * Creates a validator that asserts that the input is an array and every element passes the
 * given validator.
 *
 * @param elementValidator
 */
export function array<U>(elementValidator: Validator<U>): ArraySchema<U[]>

export function array(
    elementValidator?: Validator<any>
): ArraySchema<unknown[]> {
    if (!elementValidator) return ArraySchema.base
    else return ArraySchema.base.withElements(elementValidator)
}

/**
 * Creates a validator that asserts that the input is a boolean.
 */
export function boolean(): ValueSchema<boolean> {
    return new ValueSchema(typeOfValidators.boolean)
}

/**
 * Creates a validator that asserts that the input is a function.
 */
export function func(): FunctionSchema<Fun> {
    return FunctionSchema.base
}

/**
 * Validates that the input is an instanceof the given prototype.
 * @param clazz
 */
export function instanceOf<const T>(
    clazz: new (...args: any[]) => T
): ValueSchema<T> {
    return new ValueSchema(
        createValidator(
            substitute(locale.instanceOf, { value: clazz.name }),
            (input) => input instanceof clazz
        )
    )
}

/**
 * Creates a validator that asserts that the input is nullish or one of the given possible values.
 *
 * @param possibleValues
 */
export function isOneOf<const U extends readonly Primitive[]>(
    ...possibleValues: U
): ValueSchema<U[number]> {
    return new ValueSchema(
        createValidator(
            substitute(locale.isOneOf, {
                value: possibleValues.join(locale.oneOfSeparator),
            }),
            (input) => possibleValues.includes(input as U[number])
        )
    )
}

/**
 * Creates a validator that asserts that the input is one of the values of the given enum.
 *
 * @param enumObject The enum to validate against.
 */
export function enumOf<const T extends Record<string, Primitive>>(
    enumObject: T
): ValueSchema<T[keyof T]> {
    return isOneOf(...Object.values(enumObject)) as unknown as ValueSchema<
        T[keyof T]
    >
}

/**
 * Creates a validator that asserts that the input is null.
 */
export function exactlyNull(): Validator<null> {
    return valueValidators.null()
}

/**
 * Creates a validator that asserts that the input is nullish.
 */
export function nullish(): Validator<null | undefined> {
    return valueValidators.nullish()
}

/**
 * Creates a validator that asserts that the input is a number.
 */
export function number(): NumberSchema {
    return NumberSchema.base
}

/**
 * Creates a validator that validates the input has properties that pass their respective
 * validators.
 */
export function object<const U extends object>(
    propertyValidators: NoInfer<ExtendedPropertyValidators<AnyRecord, U>>
): ObjectSchema<U> {
    return ObjectSchema.base.extend<U>(propertyValidators)
}

/**
 * Returns a validator that asserts that the object's own enumerable properties has keys and
 * values that match their respective validators.
 *
 * Prototype members are not included.
 * Numeric keys are validated as strings. For example the object `{ [0]: 1 }` will be passed
 * to the key validator as '0'.
 *
 * To assume string keys, use {@link recordValues}
 *
 * @param keyValidator Validates each key.
 * @param valueValidator Validates each value.
 */
export function record<const K extends string | symbol, const V>(
    keyValidator: Validator<K>,
    valueValidator: Validator<V>
): RecordSchema<ReadonlyRecord<K, V>> {
    return RecordSchema.base.record(keyValidator, valueValidator)
}

/**
 * Returns a validator that asserts that the input object's own enumerable properties has
 * string keys and values that match the given validator.
 *
 * Prototype members are not included.
 *
 * @param valueValidator Validates each value.
 */
export function recordValues<const V>(
    valueValidator: Validator<V>
): RecordSchema<Record<string, V>> {
    return RecordSchema.base.recordValues(valueValidator)
}

/**
 * Returns a validator that asserts the input is a set with elements that match the given
 * element validator.
 * @param elementValidator
 */
export function set<const U>(
    elementValidator: Validator<U>
): SetSchema<Set<U>> {
    return SetSchema.base.withElements(elementValidator)
}

/**
 * Creates a validator that asserts that the input is type 'string'.
 */
export function string(): StringSchema {
    return StringSchema.base
}

/**
 * Creates a validator that asserts that the input array is a tuple whose elements match
 * the given validators.
 *
 * @param validators
 */
export function tuple<U extends readonly any[]>(
    ...validators: {
        [Index in keyof U]: Validator<U[Index]>
    }
): ArraySchema<{
    [Index in keyof U]: U[Index]
}> {
    return ArraySchema.base.tuple(...validators)
}

/**
 * Creates a validator that asserts that the input is type 'symbol'.
 */
export function symbol(): ValueSchema<symbol> {
    return new ValueSchema(typeOfValidators.symbol)
}

/**
 * Creates a validator that asserts that the input is strictly undefined.
 */
export function exactlyUndefined(): ValueSchema<undefined> {
    return new ValueSchema(valueValidators.undefined())
}

/**
 * Returns a custom
 * @param expectationMessage
 * @param isValid
 * @param inputStringify
 */
export function custom<T>(
    expectationMessage: string,
    isValid: (input: unknown) => boolean,
    inputStringify: (input: unknown) => string = (input) =>
        stringifyForPrint(input, 500)
): ValueSchema<T> {
    return new ValueSchema(
        createValidator(expectationMessage, isValid, inputStringify)
    )
}
