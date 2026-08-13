/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VinylTrackLoadOptions } from './createVinylTrackFactories'
import { memoize, requestWithRetry } from '@amazon/vinyl-util'

/**
 * The built-in track types Vinyl can infer from a URI.
 */
export type TrackType = 'hls' | 'dash' | 'src'

/**
 * Infers the track type from a URI based first on its file extension
 * then mime type.
 *
 * Returns null if the type cannot be determined.
 */
export async function inferTrackTypeFromUrl(
    url: string
): Promise<TrackType | null> {
    return inferTrackTypeFromUrlPath(url) ?? (await probeType(url))
}

export function inferTrackTypeFromUrlPath(url: string): TrackType | null {
    if (url.endsWith('.m3u8') || url.includes('.m3u8?')) return 'hls'
    if (url.endsWith('.mpd') || url.includes('.mpd?')) return 'dash'
    if (/\.(mp3|mp4|m4a|m4v|aac|ogg|opus|wav|webm)(\?|$)/i.test(url))
        return 'src'
    return null
}

export async function createTrackLoadOptionsFromUrl(
    url: string
): Promise<VinylTrackLoadOptions | null> {
    if (!url) return null
    const type = await inferTrackTypeFromUrl(url)
    if (!type) return null
    return { uri: url, type }
}

/**
 * Performs a HEAD request on the given URL to determine its track type by its
 * content-type response.
 * The result is cached.
 */
const probeType = memoize(
    async (url: string): Promise<TrackType | null> => {
        try {
            const res = await requestWithRetry(url, { method: 'HEAD' })
            if (!res.ok) return null
            const mime = (res.headers.get('content-type') ?? '').toLowerCase()
            if (mime.includes('dash+xml')) return 'dash'
            if (mime.includes('mpegurl')) return 'hls'
            if (mime.startsWith('video/') || mime.startsWith('audio/'))
                return 'src'
            return null
        } catch {
            return null
        }
    },
    (url) => url,
    /* capacity */ 30
)
