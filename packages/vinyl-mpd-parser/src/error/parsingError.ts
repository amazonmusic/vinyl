/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin, ValidationError } from '@amazon/vinyl-util'

export function throwParsingError(message: string): never {
    throw new ValidationError(message, ErrorOrigin.PARSING)
}
