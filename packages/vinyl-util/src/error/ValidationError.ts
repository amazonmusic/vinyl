/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReportableError } from '@/error/ReportableError'
import { ErrorOrigin } from '@/error/ErrorOrigin'
import type { Json } from '@/util/serialization/json'

/**
 * An error indicating that input had an invalid shape.
 */
export class ValidationError extends ReportableError {
    get [Symbol.toStringTag](): string {
        return 'ValidationError'
    }

    /**
     * @param message The validation error message.
     * @param origin The error origin, typically API (default) or SERVICE_EXTERNAL
     * @param path The property path to the invalid field.
     */
    constructor(
        message: string,
        origin: string = ErrorOrigin.API,
        readonly path: readonly string[] = []
    ) {
        super(message, origin)
        Object.setPrototypeOf(this, ValidationError.prototype)
    }

    toJSON(): Json {
        return {
            ...super.toJSON(),
            origin: this.origin,
            path: this.path,
        }
    }
}
