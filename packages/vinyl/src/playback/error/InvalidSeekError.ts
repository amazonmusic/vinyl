/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorLevel, type Json, ReportableError } from '@amazon/vinyl-util'
import { ErrorOrigin } from '@amazon/vinyl-util'
import type { ReadonlyRanges } from '@amazon/vinyl-util'

/**
 * An error indicating a seek was out of range.
 * This will have an error level of `ErrorLevel.WARN`.
 * This indicates a bad seek request, but is recoverable.
 */
export class InvalidSeekError extends ReportableError {
    get [Symbol.toStringTag](): string {
        return 'InvalidSeekError'
    }

    constructor(
        readonly time: number,
        readonly seekable: ReadonlyRanges,
        readonly tolerance: number
    ) {
        super(
            `Could not seek to time: ${time}, outside of seekable ranges ${seekable} with tolerance ${tolerance}`,
            ErrorOrigin.API,
            ErrorLevel.WARN
        )
        Object.setPrototypeOf(this, InvalidSeekError.prototype)
    }

    toJSON(): Json {
        return {
            ...super.toJSON(),
            time: this.time,
            seekable: Array.from(this.seekable),
        }
    }
}
