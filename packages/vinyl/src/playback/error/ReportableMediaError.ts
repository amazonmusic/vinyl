/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ErrorLevel,
    ErrorOrigin,
    type Json,
    type Maybe,
    ReportableError,
} from '@amazon/vinyl-util'
import { mediaErrorToJson } from '../logging/mediaErrorToJson'

/**
 * An error from the media element
 */
export class ReportableMediaError extends ReportableError {
    // Copied from MediaError to ensure compatibility in Node
    static readonly MEDIA_ERR_ABORTED = 1
    static readonly MEDIA_ERR_NETWORK = 2
    static readonly MEDIA_ERR_DECODE = 3
    static readonly MEDIA_ERR_SRC_NOT_SUPPORTED = 4

    get [Symbol.toStringTag](): string {
        return 'ReportableMediaError'
    }

    readonly reason: string
    readonly code: number

    constructor(error: Maybe<MediaError>) {
        const { name, code, message } = mediaErrorToJson(error)
        const level =
            error == null || code === ReportableMediaError.MEDIA_ERR_ABORTED
                ? ErrorLevel.SILENT
                : ErrorLevel.FATAL
        super(message, ErrorOrigin.MEDIA, level)
        this.reason = name
        this.code = code
        Object.setPrototypeOf(this, ReportableMediaError.prototype)
    }

    toJSON(): Json {
        return {
            ...super.toJSON(),
            reason: this.reason,
            code: this.code,
        }
    }
}
