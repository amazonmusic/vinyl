/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MainPlaylist, MediaPlaylist } from '@amazon/vinyl-hls-parser'
import { parseMainPlaylist, parseMediaPlaylist } from '@amazon/vinyl-hls-parser'
import type {
    Maybe,
    ReadonlyAbort,
    RequestInitOptions,
} from '@amazon/vinyl-util'
import { memoize, requestWithRetry, resolveUrl } from '@amazon/vinyl-util'
import type {
    HlsManifestData,
    HlsManifestProvider,
} from './HlsManifestProvider'

export function createUrlHlsManifestProvider(
    url: string,
    requestInit?: RequestInitOptions
): HlsManifestProvider {
    return async (abort?: ReadonlyAbort): Promise<HlsManifestData> => {
        const mainResponse = await requestWithRetry(url, requestInit, {
            abort,
        })
        const mainText = await mainResponse.text()
        const mainPlaylist = parseMainPlaylist(mainText)

        // Use the response URL (after redirects) as the base for resolving
        // relative URIs in the manifest.
        const baseUrl = mainResponse.url || url

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
    readonly defines: MainPlaylist['defines']
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
): Promise<MediaPlaylist> {
    const { uri, baseUrl, defines, requestInit, abort } = options
    const variantUrl = resolveUrl(uri, baseUrl)
    const response = await requestWithRetry(variantUrl, requestInit, { abort })
    const text = await response.text()
    return parseMediaPlaylist(text, defines)
}
