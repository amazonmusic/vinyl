/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HlsMainPlaylist } from '@amazon/vinyl-hls-parser'
import { parseMainPlaylist, parseMediaPlaylist } from '@amazon/vinyl-hls-parser'
import type {
    Maybe,
    ReadonlyAbort,
    RequestInitOptions,
} from '@amazon/vinyl-util'
import {
    memoize,
    readResponseBody,
    requestWithRetry,
    resolveUrl,
} from '@amazon/vinyl-util'
import type { HlsManifestData, HlsMediaPlaylistData } from './HlsManifestData'
import type { HlsManifestProvider } from './createHlsManifestProvider'

export function createUrlHlsManifestProvider(
    url: string,
    requestInit?: RequestInitOptions
): HlsManifestProvider {
    return async (abort?: ReadonlyAbort): Promise<HlsManifestData> => {
        const mainResponse = await requestWithRetry(url, requestInit, {
            abort,
        })
        const mainText = await readResponseBody(mainResponse, 'text')

        // Use the response URL (after redirects) as the base for resolving
        // relative URIs and for resolving #EXT-X-DEFINE:QUERYPARAM tokens.
        const baseUrl = mainResponse.url || url
        const queryParams = parseQueryParams(baseUrl)

        // The URL may be a media playlist rather than a multivariant playlist
        // (e.g. a podcast host serving one rendition). Play it as the only
        // variant, reusing the playlist already fetched.
        const mediaPlaylist: HlsMediaPlaylistData | null = isMediaPlaylist(
            mainText
        )
            ? {
                  ...parseMediaPlaylist(mainText, undefined, queryParams),
                  baseUrl,
              }
            : null
        const mainPlaylist: HlsMainPlaylist = mediaPlaylist
            ? {
                  variants: [{ bandwidth: 0, uri: baseUrl }],
                  alternativeRenditions: [],
                  sessionData: [],
              }
            : parseMainPlaylist(mainText, queryParams)

        const getMediaPlaylist = memoize(
            (uri: string) =>
                mediaPlaylist && uri === baseUrl
                    ? Promise.resolve(mediaPlaylist)
                    : fetchMediaPlaylist({
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
): Promise<HlsMediaPlaylistData> {
    const { uri, baseUrl, defines, requestInit, abort } = options
    const variantUrl = resolveUrl(uri, baseUrl)
    const response = await requestWithRetry(variantUrl, requestInit, { abort })
    const text = await readResponseBody(response, 'text')
    // The resolved URL (after redirects) is the base for the playlist's
    // relative URIs, and carries the query parameters that
    // #EXT-X-DEFINE:QUERYPARAM entries resolve against (e.g. MediaTailor ad
    // manifests). Fall back to the requested URL if the response omits it.
    const playlistUrl = response.url || variantUrl
    const queryParams = parseQueryParams(playlistUrl)
    return {
        ...parseMediaPlaylist(text, defines, queryParams),
        baseUrl: playlistUrl,
    }
}

/**
 * Returns true if the playlist is a media playlist: it lists media segments
 * (RFC 8216 §4.3.3) rather than variant streams.
 */
export function isMediaPlaylist(text: string): boolean {
    return (
        /^#EXT(INF|-X-TARGETDURATION)\b/m.test(text) &&
        !/^#EXT-X-STREAM-INF\b/m.test(text)
    )
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
