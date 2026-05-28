/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin } from '../error/ErrorOrigin'
import { ErrorLevel, ReportableError } from '../error/ReportableError'
import {
    type RequestErrorEvent,
    RequestFailureType,
} from './RequesterImplEventMap'
import { type Json, toJson } from '../util/serialization/json'
import { substitute } from '../util/string/string'

const locale = {
    requestFailed: 'request failed, attempt {current} of {total}',
    requestFailedNoRetry: 'request failed, will not retry',
    requestFailedExhaustedRetries: 'request failed, exhausted {total} tries',
} as const

/**
 * An error reported from a service response.
 */
export class RequestError extends ReportableError {
    get [Symbol.toStringTag](): string {
        return 'RequestError'
    }

    private static getErrorMessage(info: RequestErrorEvent): string {
        const tries = info.requestInfo.maxRetries + 1
        if (info.willRetry) {
            return substitute(locale.requestFailed, {
                current: info.attemptInfo.currentTry,
                total: tries,
            })
        } else if (
            info.type === RequestFailureType.NETWORK ||
            info.type === RequestFailureType.RESPONSE
        ) {
            const currentTry = info.attemptInfo.currentTry
            return currentTry < tries
                ? locale.requestFailedNoRetry
                : substitute(locale.requestFailedExhaustedRetries, {
                      total: tries,
                  })
        } else {
            return locale.requestFailedNoRetry
        }
    }

    /**
     * 500 errors are external service errors, all other errors are considered internal.
     */
    static getErrorOrigin(info: RequestErrorEvent): string {
        if (info.type === RequestFailureType.RESPONSE) {
            const status = info.responseInfo.status
            if (status >= 500 && status < 600)
                return ErrorOrigin.SERVICE_EXTERNAL
            else return ErrorOrigin.SERVICE_INTERNAL
        } else {
            return ErrorOrigin.SERVICE_INTERNAL
        }
    }

    constructor(
        /**
         * When the request failure is a !ok response, this will be set.
         */
        readonly response: Response | null,
        readonly info: RequestErrorEvent
    ) {
        super(
            RequestError.getErrorMessage(info),
            RequestError.getErrorOrigin(info),
            info.type === RequestFailureType.ABORT
                ? ErrorLevel.SILENT
                : ErrorLevel.FATAL
        )
        Object.setPrototypeOf(this, RequestError.prototype)
    }

    toJSON(): Json {
        return {
            ...super.toJSON(),
            info: toJson(this.info),
        }
    }
}
