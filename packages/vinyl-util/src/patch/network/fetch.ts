/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Fetch } from '../../network/Requester'
import { hasBrowser } from '../../client/userAgent/hasBrowser'
import { Browser } from '../../client/userAgent/defaultUserAgentRules'
import {
    changeRequestInputUrl,
    getHeaderFromRequestParams,
} from '../../util/network/request'
import { createShortUid } from '../../util/string/uid'

export function requiresPreventCacheRangeRequestsPatch(): boolean {
    return hasBrowser(Browser.CHROMIUM, null, '64')
}

/**
 * On affected UAs, Range requests from cache can fail with a TypeError.
 *
 * A message will display in the browser such as net::ERR_CONNECTION_FAILED, which isn't accessible from the Error.
 * @param original
 */
export function preventCacheRangeRequestsPatch(original: Fetch): Fetch {
    return async (input: RequestInfo | URL, init?: RequestInit) => {
        try {
            return await original(input, init)
        } catch (error) {
            if (
                error instanceof TypeError &&
                getHeaderFromRequestParams(input, init, 'range')
            ) {
                input = changeRequestInputUrl(input, (url) => {
                    // Note - the browsers affected do not support the cache: no-cache init parameter.
                    url.searchParams.append('__cache', createShortUid())
                })
                return original(input, init)
            }
            throw error
        }
    }
}

export function patchFetch(original: Fetch): Fetch {
    if (requiresPreventCacheRangeRequestsPatch()) {
        return preventCacheRangeRequestsPatch(original)
    } else {
        return original
    }
}
