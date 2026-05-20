/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorLevel, ReportableError } from './ReportableError'
import { ErrorOrigin } from '@/error/ErrorOrigin'

export class TimeoutError extends ReportableError {
    get [Symbol.toStringTag](): string {
        return 'TimeoutError'
    }

    constructor(
        message: string,
        origin: string = ErrorOrigin.INTERNAL,
        level: ErrorLevel = ErrorLevel.FATAL
    ) {
        super(message, origin, level)
        Object.setPrototypeOf(this, TimeoutError.prototype)
    }
}
