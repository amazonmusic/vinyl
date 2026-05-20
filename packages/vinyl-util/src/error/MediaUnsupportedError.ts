/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin } from '@/error/ErrorOrigin'
import { ReportableError } from '@/error/ReportableError'
import type { Json } from '@/util/serialization/json'

export class MediaUnsupportedError extends ReportableError {
    constructor(
        message: string,
        readonly code: string
    ) {
        super(message, ErrorOrigin.MEDIA)
        Object.setPrototypeOf(this, MediaUnsupportedError.prototype)
    }

    toJSON(): Json {
        return { ...super.toJSON(), code: this.code }
    }

    get [Symbol.toStringTag](): string {
        return 'MediaUnsupportedError'
    }
}
