/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin, ReportableError } from '@amazon/vinyl-util'

/**
 * @private
 */
export const xmlSchemaErrorLocale = {
    atLeastElements:
        'Expected at least {expected} occurrences of {property} but was {actual}',
    atMostElements:
        'Expected at most {expected} occurrences of {property} but was {actual}',
    cyclicReferences: 'Cyclic reference detected',
    requiredAttribute: `Attribute '{property}' is required`,
} as const

export class XmlSchemaError extends ReportableError {
    get [Symbol.toStringTag](): string {
        return 'XmlSchemaError'
    }

    constructor(message: string) {
        super(message, ErrorOrigin.PARSING)
        Object.setPrototypeOf(this, XmlSchemaError.prototype)
    }
}
