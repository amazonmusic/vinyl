/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin } from './ErrorOrigin'
import { ReportableError } from './ReportableError'

/**
 * An error indicating that a method was called with illegal arguments.
 */
export class IllegalArgumentError extends ReportableError {
    get [Symbol.toStringTag](): string {
        return 'IllegalArgumentError'
    }

    constructor(
        message: string,
        readonly isInternal = true
    ) {
        super(message, isInternal ? ErrorOrigin.INTERNAL : ErrorOrigin.API)
        Object.setPrototypeOf(this, IllegalArgumentError.prototype)
    }
}
