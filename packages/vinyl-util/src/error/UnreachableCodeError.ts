/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReportableError } from './ReportableError'

/**
 * An error indicating that a line of code was hit that should not be possible.
 */
export class UnreachableCodeError extends ReportableError {
    get [Symbol.toStringTag](): string {
        return 'UnreachableCodeError'
    }

    constructor() {
        super('Code location expected to be unreachable')
        Object.setPrototypeOf(this, UnreachableCodeError.prototype)
    }
}
