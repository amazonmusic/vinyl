/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//-------------------------------------------------------------
// Empty FetchCompletedInfo objects for tests.
//-------------------------------------------------------------

import {
    ErrorBodyType,
    type FetchRequestInfo,
    type RequestAttemptInfo,
    type RequestCaughtErrorEvent,
    type RequestNetworkErrorEvent,
    type RequestResponseErrorEvent,
    type RequestSuccessEvent,
    type ResponseInfo,
} from '@amazon/vinyl-util'
import { RequestFailureType } from '@amazon/vinyl-util'

export const emptyRequestInfo: FetchRequestInfo = {
    requestId: '',
    requestOptions: { readErrorBody: ErrorBodyType.DISABLED, serviceId: null },
    init: {},
    input: '',
    maxRetries: 0,
    timestamp: 0,
}

export const emptyRequestAttemptInfo: RequestAttemptInfo = {
    currentTry: 0,
    timestamp: 0,
}

export const emptyResponseInfo: ResponseInfo = {
    ok: false,
    redirected: false,
    status: 0,
    statusText: '',
    type: 'default',
    url: '',
    contentLength: 0,
}

export const emptyRequestSuccessEvent: RequestSuccessEvent = {
    ok: true,
    requestInfo: emptyRequestInfo,
    timestamp: 0,
    attemptInfo: emptyRequestAttemptInfo,
    responseInfo: emptyResponseInfo,
}

export const emptyInternalError: RequestCaughtErrorEvent = {
    ok: false,
    reason: null,
    requestInfo: emptyRequestInfo,
    retryAfter: null,
    timestamp: 0,
    type: RequestFailureType.INTERNAL,
    willRetry: false,
}

export const emptyNetworkError: RequestNetworkErrorEvent = {
    ok: false,
    reason: null,
    requestInfo: emptyRequestInfo,
    retryAfter: null,
    timestamp: 0,
    type: RequestFailureType.NETWORK,
    willRetry: false,
    attemptInfo: emptyRequestAttemptInfo,
}

export const emptyResponseError: RequestResponseErrorEvent = {
    ok: false,
    reason: null,
    requestInfo: emptyRequestInfo,
    retryAfter: null,
    timestamp: 0,
    type: RequestFailureType.RESPONSE,
    willRetry: false,
    attemptInfo: emptyRequestAttemptInfo,
    responseInfo: emptyResponseInfo,
}

export const emptyAbortError: RequestCaughtErrorEvent = {
    ...emptyInternalError,
    type: RequestFailureType.ABORT,
}
