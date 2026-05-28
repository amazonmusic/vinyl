/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin } from '../../error/ErrorOrigin'
import { ErrorLevel, ReportableError } from '../../error/ReportableError'

export class BufferError extends ReportableError {
    get [Symbol.toStringTag](): string {
        return 'BufferError'
    }

    constructor(
        message: string,
        origin: string = ErrorOrigin.MEDIA,
        level: ErrorLevel = ErrorLevel.FATAL
    ) {
        super(message, origin, level)
        Object.setPrototypeOf(this, BufferError.prototype)
    }
}
