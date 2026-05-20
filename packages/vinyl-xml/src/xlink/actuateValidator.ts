/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { isOneOf, type Validator } from '@amazon/vinyl-validation'
import type { actuateType } from '@/xmlns/org/w3/1999/xlink'
import { ErrorOrigin } from '@amazon/vinyl-util'

const actuateValidator: Validator<actuateType> = isOneOf('onLoad', 'onRequest')

export function assertActuateEnum(str: string): actuateType {
    actuateValidator.assert(str, ErrorOrigin.PARSING)
    return str
}
