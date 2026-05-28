/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Maybe } from '../type'
import { IllegalArgumentError } from '../../error/IllegalArgumentError'

/**
 * Given request parameters, returns the header for the given key, or null.
 */
export function getHeaderFromRequestParams(
    input: RequestInfo | URL,
    init: Maybe<RequestInit>,
    key: string
): string | null {
    if (input instanceof Request) {
        return getHeaderFromHeadersInit(input.headers, key)
    } else if (init?.headers) {
        return getHeaderFromHeadersInit(init.headers, key)
    }
    return null
}

export function getHeaderFromHeadersInit(
    headers: Readonly<HeadersInit>,
    key: string
): string | null {
    key = key.toLowerCase()
    if (headers instanceof Headers) {
        return headers.get(key)
    } else if (Array.isArray(headers)) {
        const header = headers.find(([iKey]) => iKey.toLowerCase() === key)
        return header ? header[1] : null
    } else if (typeof headers === 'object') {
        const foundKey: string | undefined = Object.keys(headers).find(
            (iKey) => iKey.toLowerCase() === key
        )
        return foundKey ? (headers as any)[foundKey] : null
    }
    throw new IllegalArgumentError('Unexpected headers type')
}

/**
 * Given fetch input, clones the input, transforms the URL and returns a new `RequestInfo | URL` input parameter.
 */
export function changeRequestInputUrl(
    input: RequestInfo | URL,
    transform: (url: URL) => void
): RequestInfo | URL {
    if (input instanceof URL) {
        const url = new URL(input)
        transform(url)
        return url
    } else if (typeof input === 'string') {
        const url = new URL(input)
        transform(url)
        return url
    } else {
        const url = new URL(input.url)
        transform(url)
        return new Request(url.toString(), input)
    }
}

/**
 * Given an object of HeadersInit type (a Headers instance, array of key-value pairs, or and object of key-value pairs),
 * returns a Record of key-value pairs.
 *
 * @param headers
 */
export function normalizeHeadersInit(
    headers: Maybe<HeadersInit>
): Record<string, string> {
    if (!headers) return {}
    if (Array.isArray(headers)) {
        const out: Record<string, string> = {}
        for (const [key, value] of headers) {
            out[key] = value
        }
        return out
    } else if (headers instanceof Headers) {
        const out: Record<string, string> = {}
        for (const [key, value] of headers.entries()) {
            out[key] = value
        }
        return out
    } else {
        return headers
    }
}
