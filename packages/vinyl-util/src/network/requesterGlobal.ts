/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { globalRef } from '../global/globalRegistry'
import type { Maybe } from '../util/type'
import { createRequester } from './createRequester'
import type { Requester, RequestInitOptions, RequestOptions } from './Requester'
import { RetryStrategy } from './RequesterImpl'

/**
 * @private
 */
export const requesterWithRetryRef = globalRef<Requester>(() => {
    return createRequester({
        retryOptions: RetryStrategy.ONE_RETRY,
    })
})

/**
 * Requests a resource.
 *
 * Note: Unlike `window.fetch`, the returned promise is expected to reject if the
 * response is !ok.
 *
 * @param input A url string, URL Object, or RequestInfo object.
 * @param init A RequestInit object.
 * @param options Additional configuration such as an abort reference or service id for metrics
 * and retries.
 */
export function requestWithRetry(
    input: RequestInfo | URL,
    init?: Maybe<RequestInitOptions>,
    options?: Partial<RequestOptions>
): Promise<Response> {
    return requesterWithRetryRef.value.request(input, init, options)
}
