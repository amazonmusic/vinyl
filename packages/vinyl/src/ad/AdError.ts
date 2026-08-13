/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorLevel, ErrorOrigin, ReportableError } from '@amazon/vinyl-util'

export class AdError extends ReportableError {
    get [Symbol.toStringTag](): string {
        return 'AdError'
    }

    constructor(
        message: string,
        origin: string = ErrorOrigin.MEDIA,
        level: ErrorLevel = ErrorLevel.FATAL
    ) {
        super(message, origin, level)
        Object.setPrototypeOf(this, AdError.prototype)
    }
}
