/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RequestResponseErrorEvent } from './RequesterImplEventMap'
import { RequestFailureType } from './RequesterImplEventMap'
import { RequestError } from './RequestError'
import { ErrorOrigin } from '../error/ErrorOrigin'
import { ErrorLevel, ReportableError } from '../error/ReportableError'

/**
 * Returns true if the given object is a RequestError with type RESPONSE.
 * @param error
 */
export function isResponseError(error: any): error is RequestError & {
    readonly info: RequestResponseErrorEvent
} {
    return (
        error instanceof RequestError &&
        error.info.type === RequestFailureType.RESPONSE
    )
}

/**
 * The body representations {@link readResponseBody} can produce.
 */
export type ResponseBodyType = 'arrayBuffer' | 'text' | 'json'

/**
 * Reads a response body, classifying a read failure with a service error origin.
 *
 * The requester (`requestWithRetry`/`request`) classifies only the `fetch` and
 * the response status; it returns the {@link Response} before the body is
 * consumed. Reading the body stream can fail *after* a successful response —
 * e.g. the connection drops mid-body — rejecting with a bare `TypeError`
 * ("Failed to fetch") that carries no origin and would otherwise be reported
 * with {@link ReportableError}'s `internal` default. This reads the body on the
 * caller's behalf and rethrows such failures as a {@link ReportableError} with a
 * service origin (mirroring {@link RequestError} origin classification: a 5xx
 * status is `serviceExternal`, anything else `serviceInternal`). An aborted read
 * is preserved as a silent error so an intentional cancellation is not reported.
 */
export async function readResponseBody(
    response: Response,
    as: 'arrayBuffer'
): Promise<ArrayBuffer>
export async function readResponseBody(
    response: Response,
    as: 'text'
): Promise<string>
export async function readResponseBody(
    response: Response,
    as: 'json'
): Promise<any>
export async function readResponseBody(
    response: Response,
    as: ResponseBodyType
): Promise<ArrayBuffer | string | unknown> {
    let read: Promise<ArrayBuffer | string | unknown>
    switch (as) {
        case 'arrayBuffer':
            read = response.arrayBuffer()
            break
        case 'text':
            read = response.text()
            break
        case 'json':
            read = response.json()
            break
    }
    try {
        return await read
    } catch (error: any) {
        // A cancelled read is intentional; keep it silent like the requester
        // treats an aborted request.
        if (error?.name === 'AbortError')
            throw new ReportableError(
                'Response body read aborted',
                ErrorOrigin.INTERNAL,
                ErrorLevel.SILENT
            )
        const status = response.status
        const origin =
            status >= 500 && status < 600
                ? ErrorOrigin.SERVICE_EXTERNAL
                : ErrorOrigin.SERVICE_INTERNAL
        throw new ReportableError(
            `Failed to read response body: ${String(error)}`,
            origin,
            ErrorLevel.FATAL
        )
    }
}
