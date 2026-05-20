/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Timestamp } from '@/util/date/date'
import type { ErrorBodyType } from '@/network/Requester'

/**
 * Events {@link RequesterImpl} emits.
 */
export interface RequesterImplEventMap {
    /**
     * A request has been requested.
     * This is emitted immediately when {@link Requester.request} is called.
     */
    readonly request: RequestEvent

    /**
     * A request attempt has begun. For implementations with retry behavior, this is expected to be
     * emitted for each try.
     */
    readonly requestAttemptStart: RequestAttemptStartEvent

    /**
     * A request attempt has completed.
     */
    readonly requestAttemptComplete: RequestCompletedEvent

    /**
     * The request promise is about to settle.
     */
    readonly requestComplete: RequestCompletedEvent
}

export interface RequestEvent {
    /**
     * Information about the request.
     */
    readonly requestInfo: FetchRequestInfo
}

export interface RequestAttemptStartEvent {
    /**
     * Information about the request.
     */
    readonly requestInfo: FetchRequestInfo

    /**
     * Information about the current attempt.
     */
    readonly attemptInfo: RequestAttemptInfo
}

/**
 * When a request has been made, information about the request is gathered for logging.
 */
export interface FetchRequestInfo {
    /**
     * The identifier for the request. The request id for the `requesting` event will match its
     * corresponding `requestComplete` event.
     */
    readonly requestId: string

    /**
     * The input parameter passed to `request`.
     */
    readonly input: RequestInfo | URL

    /**
     * The init parameter passed to `request`.
     */
    readonly init: RequestInit

    /**
     * The maximum number of retries.
     */
    readonly maxRetries: number

    /**
     * Options the request is using.
     */
    readonly requestOptions: {
        /**
         * The resolved service id.
         */
        readonly serviceId: string | null

        /**
         * Determines how error responses are read and reported.
         */
        readonly readErrorBody: ErrorBodyType
    }

    /**
     * The timestamp the request was originally requested.
     */
    readonly timestamp: Timestamp
}

/**
 * Information about the current try.
 */
export interface RequestAttemptInfo {
    /**
     * The current try (1 = first).
     */
    readonly currentTry: number

    /**
     * The timestamp the actual request attempt began. This will be after awaiting network
     * availability.
     */
    readonly timestamp: Timestamp
}

/**
 * Information about a request completion, either from a successful response or a failure.
 */
export type RequestCompletedEvent = RequestSuccessEvent | RequestErrorEvent

export interface RequestCompletedEventBase {
    /**
     * True if the request was successful.
     */
    readonly ok: boolean

    /**
     * The local timestamp of the request result or error.
     */
    readonly timestamp: Timestamp

    /**
     * Information about the request.
     */
    readonly requestInfo: FetchRequestInfo
}

export interface RequestSuccessEvent extends RequestCompletedEventBase {
    /**
     * The response was successful.
     */
    readonly ok: true

    /**
     * The serializable and loggable response.
     */
    readonly responseInfo: ResponseInfo

    /**
     * Information about the current attempt.
     */
    readonly attemptInfo: RequestAttemptInfo
}

export enum RequestFailureType {
    /**
     * The request has been aborted.
     */
    ABORT = 'abort',

    /**
     * The request failed due to a caught internal error.
     */
    INTERNAL = 'internal',

    /**
     * The request failed with a caught error.
     */
    NETWORK = 'network',

    /**
     * An `!ok` response was received.
     */
    RESPONSE = 'response',
}

export type RequestErrorEvent =
    | RequestCaughtErrorEvent
    | RequestNetworkErrorEvent
    | RequestResponseErrorEvent

export interface RequestErrorEventBase extends RequestCompletedEventBase {
    /**
     * The request failed.
     */
    readonly ok: false

    /**
     * The failure type.
     */
    readonly type: RequestFailureType

    /**
     * If false, the request will not be retried, even if there are more tries remaining.
     *
     * This will be false if the error is an internal error, retries have been exhausted or the
     * response did not pass the `shouldRetry` filter.
     */
    readonly willRetry: boolean

    /**
     * The timestamp of the next try.
     * If `willRetry` is true, the request will try again at this timestamp.
     */
    readonly retryAfter: Timestamp | null

    /**
     * The caught or rejected reason.
     */
    readonly reason: any
}

export interface RequestCaughtErrorEvent extends RequestErrorEventBase {
    readonly type: RequestFailureType.INTERNAL | RequestFailureType.ABORT

    /**
     * Caught errors will not be retried.
     */
    readonly willRetry: false
}

export interface RequestNetworkErrorEvent extends RequestErrorEventBase {
    readonly type: RequestFailureType.NETWORK

    /**
     * Information about the current attempt.
     */
    readonly attemptInfo: RequestAttemptInfo
}

export interface RequestResponseErrorEvent extends RequestErrorEventBase {
    readonly type: RequestFailureType.RESPONSE

    /**
     * The serializable and loggable response.
     */
    readonly responseInfo: ResponseInfo

    /**
     * Information about the current attempt.
     */
    readonly attemptInfo: RequestAttemptInfo
}

/**
 * Serializable response metadata, excluding the body.
 */
export interface ResponseInfo {
    /**
     * True if status is in the 200–299 range.
     */
    readonly ok: boolean

    /**
     * True if the response resulted from a redirect.
     */
    readonly redirected: boolean

    /**
     * HTTP status code (e.g. 200).
     */
    readonly status: number

    /**
     * HTTP status text (e.g. "OK").
     */
    readonly statusText: string

    /**
     * Type of response (e.g. "basic", "cors").
     */
    readonly type: ResponseType

    /**
     * Final resolved URL of the response.
     */
    readonly url: string

    /**
     * Size of the response body in bytes, or null if unknown.
     */
    readonly contentLength: number | null
}
