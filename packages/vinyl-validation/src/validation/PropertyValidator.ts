/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Validator } from '@/validation/Validator'
import type { Merge } from '@amazon/vinyl-util'

export interface PropertyValidatorOptions {
    /**
     * If true, when the property is omitted, the object schema should not fail validation.
     */
    readonly optional: boolean
}

/**
 * A utility type for overriding the options type on a validator.
 * This will strip the types of the overridden options and set to the new types.
 */
export type PropertyValidatorWithOptions<
    ValidatorType extends PropertyValidator<any, any>,
    T,
    Options extends PropertyValidatorOptions,
> = Omit<ValidatorType, keyof PropertyValidator<any, any>> &
    PropertyValidator<T, Merge<ValidatorType['options'], Options>>

export interface PropertyValidator<
    T,
    PropertyOptionsType extends PropertyValidatorOptions,
> extends Validator<T> {
    readonly options: PropertyOptionsType

    optional(): PropertyValidatorWithOptions<
        this,
        T,
        { readonly optional: true }
    >

    required(): PropertyValidatorWithOptions<
        this,
        T,
        { readonly optional: false }
    >
}
