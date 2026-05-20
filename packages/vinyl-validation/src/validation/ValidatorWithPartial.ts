/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PartialDeep } from '@amazon/vinyl-util'
import type { Validator } from './Validator'

export interface ValidatorWithPartial<Output extends Input, Input>
    extends Validator<Output, Input> {
    partial(): ValidatorWithPartial<Partial<Output> & Input, Input>
    partialDeep(): ValidatorWithPartial<PartialDeep<Output> & Input, Input>
}

/**
 * Returns true if the given validator is an object validator.
 * @param validator
 */
export function isValidatorWithPartial<Output extends Input, Input>(
    validator: Validator<Output, Input>
): validator is ValidatorWithPartial<Output, Input> {
    return 'partial' in validator && 'partialDeep' in validator
}

/**
 * If the given validator is an object validator, it will be cloned to a deep partial validator,
 * otherwise returns the validator as is.
 *
 * @param validator
 */
export function maybeToDeepPartial(validator: Validator<any>): Validator<any> {
    return isValidatorWithPartial(validator)
        ? validator.partialDeep()
        : validator
}

/**
 * If the given validator is an object validator, it will be cloned to a partial validator,
 * otherwise returns the validator as is.
 *
 * @param validator
 */
export function maybeToPartial(validator: Validator<any>): Validator<any> {
    return isValidatorWithPartial(validator) ? validator.partial() : validator
}
