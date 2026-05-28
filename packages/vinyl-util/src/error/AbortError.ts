/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorLevel, ReportableError } from './ReportableError'
import { ErrorOrigin } from './ErrorOrigin'

export class AbortError extends ReportableError {
    get [Symbol.toStringTag](): string {
        return 'AbortError'
    }

    constructor(
        message = 'Operation aborted',
        origin: string = ErrorOrigin.INTERNAL,
        level: ErrorLevel = ErrorLevel.SILENT
    ) {
        super(message, origin, level)
        Object.setPrototypeOf(this, AbortError.prototype)
    }
}
