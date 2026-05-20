/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MutableRequestParams {
    input: string
    init: Omit<RequestInit, 'signal'>
}

/**
 * Mutates a request before it's made.
 * A request interceptor can be set in Vinyl dependencies. It will be called immediately before a request is made.
 * The interceptor may modify the request, for example to add headers, change caching, or client-side redirection.
 * Example to disable caching:
 *
 * `(params) => { params.init.cache = 'no-cache' }`
 */
export type RequestInterceptor = (params: MutableRequestParams) => void
