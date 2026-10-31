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
import { getInputUrl } from './requesterUtil'
import { isPlainObject } from '../util/object/object'
import { type Json, toJson } from '../util/serialization/json'
import { substitute } from '../util/string/string'

const locale = {
    requestFailed: 'request failed, attempt {current} of {total}',
    requestFailedNoRetry: 'request failed, will not retry',
    requestFailedExhaustedRetries: 'request failed, exhausted {total} tries',
} as const

const REDACTED = '[redacted]'

const CREDENTIAL_HEADER =
    /^(authorization|proxy-authorization|x-amz-access-token|cookie|set-cookie|x-api-key|.*csrf.*)$/i

const SECRET_FIELD =
    /^(refresh_token|access_token|id_token|code_verifier|client_secret)$/i

const SECRET_ASSIGNMENT =
    /((?:refresh_token|access_token|id_token|code_verifier|client_secret)["']?\s*[:=]\s*["']?)[^&#\s"',}]+/gi
const QUERY_CODE = /([?&#]code=)[^&#\s"']*/gi
const BEARER = /\b(Bearer\s+)[^\s"',]+/gi

/**
 * Returns the given text with secret values masked.
 */
export type RedactText = (text: string) => string

/**
 * Masks token and secret values in free text, such as a URL, a form body or a JSON string.
 */
export function defaultRedactText(text: string): string {
    return text
        .replace(SECRET_ASSIGNMENT, `$1${REDACTED}`)
        .replace(QUERY_CODE, `$1${REDACTED}`)
        .replace(BEARER, `$1${REDACTED}`)
}

function redactValue(value: unknown, redactText: RedactText): unknown {
    if (typeof value === 'string') return redactText(value)
    if (Array.isArray(value))
        return value.map((entry) => redactValue(entry, redactText))
    if (!isPlainObject(value)) return value
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(
        value as Record<string, unknown>
    )) {
        out[key] = SECRET_FIELD.test(key)
            ? REDACTED
            : redactValue(entry, redactText)
    }
    return out
}

function redactHeaders(
    headers: HeadersInit,
    redactText: RedactText
): [string, string][] {
    const redactHeaderEntry = (
        name: string,
        value: string
    ): [string, string] => [
        name,
        CREDENTIAL_HEADER.test(name) ? REDACTED : redactText(value),
    ]
    if (Array.isArray(headers)) {
        return headers.map(([name, value]) => redactHeaderEntry(name, value))
    }
    if (typeof Headers !== 'undefined' && headers instanceof Headers) {
        const entries: [string, string][] = []
        headers.forEach((value, name) =>
            entries.push(redactHeaderEntry(name, value))
        )
        return entries
    }
    return Object.entries(headers).map(([name, value]) =>
        redactHeaderEntry(name, value)
    )
}

/**
 * The serializable form of a request failure that carries no credentials: the request body is
 * dropped, credential headers and secret query values are masked.
 */
function redactErrorInfo(
    info: RequestErrorEvent,
    redactText: RedactText
): Json {
    const { requestInfo, ...rest } = info
    const { input, init, ...requestRest } = requestInfo
    const { body: _body, headers, ...initRest } = init
    const json: Record<string, unknown> = toJson(rest)
    json.reason = redactValue(json.reason, redactText)
    if (info.type === RequestFailureType.RESPONSE) {
        json.responseInfo = {
            ...info.responseInfo,
            url: redactText(info.responseInfo.url),
        }
    }
    return {
        ...json,
        requestInfo: {
            ...toJson(requestRest),
            input: redactText(getInputUrl(input)),
            init: {
                ...toJson(initRest),
                ...(headers
                    ? { headers: redactHeaders(headers, redactText) }
                    : {}),
            },
        },
    }
}

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
        readonly info: RequestErrorEvent,
        /**
         * Masks secrets in the text values of {@link toJSON}.
         */
        private readonly redactText: RedactText = defaultRedactText
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
            info: redactErrorInfo(this.info, this.redactText),
        }
    }
}
