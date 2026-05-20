/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin } from '@amazon/vinyl-util'
import { ReportableError } from '@amazon/vinyl-util'

/**
 * An error emitted from the SourceBuffer.
 */
export class SourceBufferError extends ReportableError {
    get [Symbol.toStringTag](): string {
        return 'SourceBufferError'
    }

    constructor(
        message = `A SourceBuffer error has occurred.`,
        origin = ErrorOrigin.MEDIA
    ) {
        super(message, origin)
        Object.setPrototypeOf(this, SourceBufferError.prototype)
    }
}
