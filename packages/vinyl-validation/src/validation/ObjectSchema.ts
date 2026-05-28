/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    AnyRecord,
    IsPropertyOptional,
    PartialDeep,
} from '@amazon/vinyl-util'
import { merge, ownKeys, substitute } from '@amazon/vinyl-util'
import type { ValidatorWithPartial } from './ValidatorWithPartial'
import { maybeToDeepPartial, maybeToPartial } from './ValidatorWithPartial'
import { ValueSchema } from './ValueSchema'
import { typeOfValidators } from './typeOfValidators'
import type { ValidationErrorMessage } from './Validator'
import { createDeepValidator } from './Validator'
import type { PropertyValidator } from './PropertyValidator'
import type { Equal } from '@amazon/vinyl-util'

/**
 * @private
 */
const locale = {
    extend: '{\n{body}\n}',
    prop: '{key}: {value}',
    propSeparator: ',\n',
    indent: '  ',
    required: `property '{key}' is required`,
} as const

export const objectValidators = {
    /**
     * Creates a validator that validates the input has properties that pass their respective
     * validators.
     *
     * @param propertyValidators
     */
    properties<U extends object>(propertyValidators: {
        readonly [P in keyof U]-?: PropertyValidator<
            Required<U>[P],
            { optional: IsPropertyOptional<U, P> }
        >
    }): ValidatorWithPartial<U, object> {
        const propertiesDescriptions: string[] = []
        const keys = ownKeys(propertyValidators)
        for (const key of keys) {
            const validator = propertyValidators[key]
            propertiesDescriptions.push(
                substitute(locale.prop, {
                    key: String(key) + (validator.options.optional ? '?' : ''),
                    value: validator.description,
                })
            )
        }
        const description = substitute(locale.extend, {
            body: propertiesDescriptions
                .join(locale.propSeparator)
                .split('\n')
                .map((line) => locale.indent + line)
                .join('\n'),
        })
        const validator = createDeepValidator(
            description,
            (input: any, options, path) => {
                const errors: ValidationErrorMessage[] = []
                for (const key of keys) {
                    const validator = propertyValidators[key]
                    if (key in input) {
                        const value = input[key]
                        errors.push(
                            ...validator.validate(
                                value,
                                options,
                                path.concat(String(key))
                            )
                        )
                    } else {
                        // Missing property
                        if (!validator.options.optional) {
                            errors.push({
                                message: substitute(locale.required, { key }),
                                path: path.concat(String(key)),
                            })
                        }
                    }
                    if (!options.all && errors.length) return errors
                }
                return errors
            }
        )
        return merge(validator, {
            partial(): ValidatorWithPartial<Partial<U>, object> {
                const optionalPropertyValidators = {} as any
                for (const key of keys) {
                    optionalPropertyValidators[key] =
                        propertyValidators[key].optional()
                }
                return objectValidators.properties<Partial<U>>(
                    optionalPropertyValidators
                )
            },

            partialDeep(): ValidatorWithPartial<PartialDeep<U>, object> {
                const optionalPropertyValidators = {} as any
                for (const key of keys) {
                    optionalPropertyValidators[key] = maybeToDeepPartial(
                        propertyValidators[key].optional()
                    )
                }
                return objectValidators.properties<PartialDeep<U>>(
                    optionalPropertyValidators
                )
            },
        })
    },
} as const

/**
 * Chainable object validators.
 */
export class ObjectSchema<T extends object>
    extends ValueSchema<T>
    implements ValidatorWithPartial<T, unknown>
{
    private static _base: ObjectSchema<AnyRecord> | null = null

    /**
     * The base Object validator validating that the input is an object.
     */
    static get base(): ObjectSchema<AnyRecord> {
        if (this._base == null)
            this._base = new ObjectSchema(typeOfValidators.object)
        return this._base
    }

    /**
     * Creates a validator that validates the input has properties that pass their respective
     * validators.
     *
     * @param propertyValidators
     */
    extend<U extends object>(
        propertyValidators: NoInfer<ExtendedPropertyValidators<T, U>>
    ): ObjectSchema<U> {
        return this.chain(objectValidators.properties(propertyValidators))
    }

    /**
     * Allows all properties to be undefined.
     */
    partial(): ObjectSchema<Partial<T>> {
        return this.clone(maybeToPartial)
    }

    /**
     * Allows all recursive properties to be undefined.
     */
    partialDeep(): ObjectSchema<PartialDeep<T>> {
        return this.clone(maybeToDeepPartial)
    }

    /**
     * Casts the type parameter.
     */
    cast<T extends object>(): ObjectSchema<T> {
        return this as any
    }
}

export type ExtendedPropertyValidators<T extends object, U extends object> = {
    // REQUIRED:
    // - Keys in U but not in T
    // - Keys in both where U[K] !== T[K]
    [K in keyof U as K extends keyof T
        ? Equal<U[K], T[K]> extends true
            ? never
            : K
        : K]-?: ExtendedPropertyValidator<U & T, K>
} & {
    // OPTIONAL:
    // - Keys where U[K] === T[K] (and therefore K ∈ keyof T)
    [K in keyof U as K extends keyof T
        ? Equal<U[K], T[K]> extends true
            ? K
            : never
        : never]?: ExtendedPropertyValidator<U & T, K>
}

export type ExtendedPropertyValidator<
    U extends object,
    P extends keyof U,
> = PropertyValidator<Required<U>[P], { optional: IsPropertyOptional<U, P> }>
