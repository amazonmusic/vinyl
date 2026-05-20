/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin, type Json } from '@amazon/vinyl-util'
import { ErrorLevel, ReportableError } from '@amazon/vinyl-util'

/**
 * An error originating from the DrmController.
 * If an error comes from a key session, `extra.error` will be set with the original error and origin will be DRM.
 */
export class DrmError<ExtraType = any> extends ReportableError {
    get [Symbol.toStringTag](): string {
        return 'DrmError'
    }

    constructor(
        readonly message: string,
        private readonly extra: ExtraType | null = null,
        readonly origin: string = ErrorOrigin.DRM,
        readonly level: ErrorLevel = ErrorLevel.FATAL
    ) {
        super(message, origin, level)
        Object.setPrototypeOf(this, DrmError.prototype)
    }

    toJSON(): Json {
        return { ...super.toJSON(), extra: this.extra }
    }
}
