/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReportableError } from './ReportableError'

/**
 * An error indicating a stack overflow has occurred.
 */
export class StackOverflowError extends ReportableError {
    get [Symbol.toStringTag](): string {
        return 'StackOverflowError'
    }

    constructor(message: string) {
        super(message)
        Object.setPrototypeOf(this, StackOverflowError.prototype)
    }
}
