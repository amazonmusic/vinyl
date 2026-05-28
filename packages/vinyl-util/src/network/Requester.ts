/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReadonlyAbort } from '../util/async/Abort'
import type { Maybe } from '../util/type'

/**
 * Init options for the request.
 *
 * This mirrors the fetch init parameter omitting `signal`. For request cancellation, use
 * `abort` on RequestOptions.
 */
export type RequestInitOptions = Readonly<Omit<RequestInit, 'signal'>>

/**
 * Encapsulates the parameters needed to make a request.
 */
export interface RequestParams {
    readonly input: RequestInfo | Readonly<URL>
    readonly init?: Maybe<Readonly<RequestInitOptions>>
    readonly requestOptions?: Maybe<RequestOptions>
}

/**
 * An abstraction to fetching resources.
 * Implementations may have retry or throttling behaviors.
 */
export interface Requester {
    /**
     * Requests a resource.
     *
     * Note: Unlike `window.fetch`, the returned promise is expected to reject if the
     * response is !ok.
     */
    request(
        input: RequestInfo | Readonly<URL>,
        init?: Maybe<RequestInitOptions>,
        requestOptions?: Maybe<RequestOptions>
    ): Promise<Response>
}

/**
 * Configuration for a fetch request.
 */
export interface RequestOptions {
    /**
     * If supplied, will cancel the request on abort.
     */
    readonly abort?: Maybe<ReadonlyAbort>

    /**
     * Determines how error responses are read and reported.
     */
    readonly readErrorBody?: ErrorBodyType

    /**
     * The service id is used to obtain a service controller for that service.
     * If nullish, then empty service metrics will be used.
     */
    readonly serviceId?: Maybe<string>
}

export enum ErrorBodyType {
    DISABLED,
    TEXT,
    JSON,
}

/**
 * The signature of `window.fetch`. Provided as a dependency for testing.
 */
export type Fetch = (
    input: RequestInfo | URL,
    init?: RequestInit
) => Promise<Response>

/**
 * Capped exponential backoff timing with jitter.
 *
 * The timing follows the equation:
 * `distribution() * min(interval * pow(exponentBase, failureCount), max)`
 */
export interface BackoffOptions {
    /**
     * The maximum time to wait between tries, in seconds, regardless of how many consecutive
     * failures.
     */
    readonly maxTime: number

    /**
     * The interval in seconds, multiplied by `pow(exponentBase, failureCount)`.
     */
    readonly interval: number

    /**
     * pow(exponentBase, failureCount)
     */
    readonly exponentBase: number

    /**
     * The distribution function to randomize request retry timing.
     * This is to prevent all users from making retries at the same time.
     */
    readonly distribution: () => number
}
