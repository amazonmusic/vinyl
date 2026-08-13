/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    HlsMainPlaylist,
    HlsMediaPlaylist,
} from '@amazon/vinyl-hls-parser'
import { parseMainPlaylist, parseMediaPlaylist } from '@amazon/vinyl-hls-parser'
import type {
    Maybe,
    ReadonlyAbort,
    RequestInitOptions,
} from '@amazon/vinyl-util'
import { memoize, requestWithRetry, resolveUrl } from '@amazon/vinyl-util'
import type { HlsManifestData } from './HlsManifestData'
import type { HlsManifestProvider } from './createHlsManifestProvider'

export function createUrlHlsManifestProvider(
    url: string,
    requestInit?: RequestInitOptions
): HlsManifestProvider {
    return async (abort?: ReadonlyAbort): Promise<HlsManifestData> => {
        const mainResponse = await requestWithRetry(url, requestInit, {
            abort,
        })
        const mainText = await mainResponse.text()

        // Use the response URL (after redirects) as the base for resolving
        // relative URIs and for resolving #EXT-X-DEFINE:QUERYPARAM tokens.
        const baseUrl = mainResponse.url || url
        const mainPlaylist = parseMainPlaylist(
            mainText,
            parseQueryParams(baseUrl)
        )

        const getMediaPlaylist = memoize(
            (uri: string) =>
                fetchMediaPlaylist({
                    uri,
                    baseUrl,
                    defines: mainPlaylist.defines,
                    requestInit,
                    abort,
                }),
            (uri) => uri
        )

        return {
            mainPlaylist,
            baseUrl,
            getMediaPlaylist,
        }
    }
}

export interface FetchMediaPlaylistOptions {
    /** The variant URI to resolve against the base URL. */
    readonly uri: string
    /** The base URL for resolving relative URIs. */
    readonly baseUrl: string
    /** Variable definitions from the main playlist. */
    readonly defines: HlsMainPlaylist['defines']
    /** Optional request configuration. */
    readonly requestInit?: Maybe<RequestInitOptions>
    /** Optional abort signal. */
    readonly abort?: Maybe<ReadonlyAbort>
}

/**
 * Fetches and parses an HLS media playlist from a variant URI.
 */
export async function fetchMediaPlaylist(
    options: FetchMediaPlaylistOptions
): Promise<HlsMediaPlaylist> {
    const { uri, baseUrl, defines, requestInit, abort } = options
    const variantUrl = resolveUrl(uri, baseUrl)
    const response = await requestWithRetry(variantUrl, requestInit, { abort })
    const text = await response.text()
    // The resolved URL (after redirects) carries the query parameters that
    // #EXT-X-DEFINE:QUERYPARAM entries resolve against (e.g. MediaTailor ad
    // manifests). Fall back to the requested URL if the response omits it.
    const queryParams = parseQueryParams(response.url || variantUrl)
    return parseMediaPlaylist(text, defines, queryParams)
}

/**
 * Extracts a URL's query parameters into a plain record for
 * `#EXT-X-DEFINE:QUERYPARAM` resolution. Returns undefined when the URL has no
 * query string so the parser can skip substitution entirely.
 */
function parseQueryParams(url: string): Record<string, string> | undefined {
    const queryStart = url.indexOf('?')
    if (queryStart === -1) return undefined
    const params: Record<string, string> = {}
    const search = new URLSearchParams(url.substring(queryStart + 1))
    for (const [key, value] of search) params[key] = value
    return params
}
