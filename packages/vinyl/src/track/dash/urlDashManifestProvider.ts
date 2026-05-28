/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Maybe } from '@amazon/vinyl-util'
import type { RequestInitOptions } from '@amazon/vinyl-util'
import type {
    MutableRequestParams,
    RequestInterceptor,
} from '@amazon/vinyl-util'
import { noop } from '@amazon/vinyl-util'
import { clone, getLocation, resolveUrl } from '@amazon/vinyl-util'
import { requestWithRetry } from '@amazon/vinyl-util'
import { parseDashManifest } from '@amazon/vinyl-mpd-parser'
import type { DashManifestProvider } from './DashManifestProvider'

/**
 * Creates a DashManifestProvider which performs a request to retrieve a dash manifest.
 * Can be a relative path.
 *
 * Usage example:
 *
 * ```createRequesterDashManifestProvider('https://example.com/manifest.mpd')```
 * @param input The resource location of the dash manifest.
 * @param init Optional request options such as headers.
 * @param requestInterceptor An optional transformer to mutate request parameters before the request is made.
 */
export function urlDashManifestProvider(
    input: string,
    init?: Maybe<RequestInitOptions>,
    requestInterceptor: RequestInterceptor = noop
): DashManifestProvider {
    return async (abort) => {
        const params: MutableRequestParams = {
            input: resolveUrl(input, getLocation().href),
            init: clone(init) ?? {},
        }
        requestInterceptor(params)
        const response = await requestWithRetry(params.input, params.init, {
            abort,
        })
        const xml = await response.text()
        const manifest = parseDashManifest(xml)
        const baseInput = response.url || params.input
        return {
            manifest,
            baseUrl: resolveUrl('./', baseInput),
        }
    }
}
