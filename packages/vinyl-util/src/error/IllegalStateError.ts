/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReportableError } from './ReportableError'

/**
 * An error indicating an unexpected state.
 */
export class IllegalStateError extends ReportableError {
    get [Symbol.toStringTag](): string {
        return 'IllegalStateError'
    }

    constructor(message: string) {
        super(message)
        Object.setPrototypeOf(this, IllegalStateError.prototype)
    }
}
