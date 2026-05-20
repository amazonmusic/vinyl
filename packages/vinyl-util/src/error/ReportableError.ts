/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin } from './ErrorOrigin'
import type { Json } from '@/util/serialization/json'

export enum ErrorLevel {
    /**
     * Fatal errors are not recoverable.
     */
    FATAL = 'fatal',

    /**
     * Warn level errors should be reported, but are recoverable.
     */
    WARN = 'warn',

    /**
     * Silent errors should not be reported. For example aborting a play operation due to a new track loading.
     */
    SILENT = 'silent',
}

/**
 * A Serializable Error that contains an error origin.
 */
export class ReportableError extends Error {
    get [Symbol.toStringTag](): string {
        return 'ReportableError'
    }

    constructor(
        message?: string,
        readonly origin: string = ErrorOrigin.INTERNAL,
        readonly level: ErrorLevel = ErrorLevel.FATAL
    ) {
        super(message)
        Object.setPrototypeOf(this, ReportableError.prototype)
    }

    get name(): string {
        return this[Symbol.toStringTag]
    }

    /**
     * All ReportableError instances must be serializable.
     */
    toJSON(): Json {
        return {
            level: this.level,
            message: this.message,
            name: this.name,
            origin: this.origin,
            stack: this.stack,
        }
    }
}

/**
 * Returns true if the given object is a ReportableError.
 */
export function isReportableError(error: any): error is ReportableError {
    // This does not use instanceof ReportableError to avoid ambiguity in the case where this module
    // is loaded multiple times due to version conflicts or code splitting.
    return error instanceof Error && 'origin' in error && 'level' in error
}

/**
 * Returns true if the error is a ReportableError and is level SILENT.
 * @param error
 */
export function isSilentError(error: any): boolean {
    return isReportableError(error) && error.level === ErrorLevel.SILENT
}
