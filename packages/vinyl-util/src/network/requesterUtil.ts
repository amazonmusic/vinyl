/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * Network utility methods to support RequesterImpl.
 *
 * @brief
 */

import { globalTarget } from '@/global/globalTarget'
import { logWarn } from '@/logging/Logger'
import type { ResponseInfo } from './RequesterImplEventMap'
import type { Timestamp } from '@/util/date/date'
import type { Maybe } from '@/util/type'
import { parseIntSafe } from '@/util/serialization/primitives'

const retryableStatusCodes = new Set([
    429, // Too many requests
    503, // Service unavailable
    504, // Gateway timeout
])

/**
 * Returns true if the failed request should be retried.
 * @private
 */
export function shouldRetry(status: number): boolean {
    return retryableStatusCodes.has(status)
}

/**
 * The default jitter amount after waiting for a retry-after timestamp.
 */
export function retryAfterJitter(): number {
    return 90 * Math.random()
}

const NUMBER_REGEXP = /^\s*\d+\s*$/

/**
 * Retry-After  = "Retry-After" ":" ( HTTP-date | delta-seconds )
 * https://www.rfc-editor.org/rfc/rfc2616#page-141
 *
 * @param retryAfter The string to parse into a timestamp. If nullish, null is returned.
 * @returns The unix timestamp to wait until before retrying. If the Retry-After header
 * could not be found, or provided a date that cannot be parsed, returns null.
 */
export function parseRetryAfter(retryAfter: Maybe<string>): Timestamp | null {
    if (retryAfter == null) return null
    if (NUMBER_REGEXP.test(retryAfter)) {
        return Date.now() + parseInt(retryAfter) * 1000
    }
    if (!retryAfter.toLowerCase().includes('gmt')) retryAfter += ' GMT'
    const timestamp = Date.parse(retryAfter)
    if (Number.isNaN(timestamp)) {
        logWarn(globalTarget, `Invalid retry-after header: ${retryAfter}`)
        return null
    }
    return timestamp
}

/**
 * Returns serializable response information.
 *
 * @param response The Response object. The body will not be read, this does not need to be cloned.
 */
export function getResponseInfo(response: Response): ResponseInfo {
    const contentLength = parseIntSafe(response.headers.get('content-length'))
    return {
        ok: response.ok,
        redirected: response.redirected,
        status: response.status,
        statusText: response.statusText,
        type: response.type,
        url: response.url,
        contentLength,
    }
}
