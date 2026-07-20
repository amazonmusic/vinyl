/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MainPlaylist } from '@amazon/vinyl-hls-parser'
import { resolveUrl } from '@amazon/vinyl-util'
import type { TextTrackInfo } from './TextTrack'

/**
 * Discovers sidecar text tracks from an HLS multivariant playlist.
 *
 * Per RFC 8216 §4.3.4.2, subtitle renditions are signaled with
 * `EXT-X-MEDIA:TYPE=SUBTITLES` and (when usable as sidecar) carry a `URI`
 * attribute pointing at a media playlist or, in the simplified single-file
 * case, a `.vtt` file directly.
 *
 * Closed captions (`TYPE=CLOSED-CAPTIONS`) are intentionally excluded - they
 * are delivered in-band with the video stream and are surfaced by the browser
 * automatically, not through a sidecar fetch.
 *
 * @param mainPlaylist The parsed HLS main playlist.
 * @param baseUrl The URL of the main playlist, used to resolve relative URIs.
 */
export function discoverHlsTextTracks(
    mainPlaylist: MainPlaylist,
    baseUrl: string
): readonly TextTrackInfo[] {
    const out: TextTrackInfo[] = []
    let index = 0
    const parentDefines =
        mainPlaylist.defines && Object.keys(mainPlaylist.defines).length > 0
            ? mainPlaylist.defines
            : undefined
    for (const rendition of mainPlaylist.alternativeRenditions) {
        if (rendition.type !== 'SUBTITLES') continue
        if (!rendition.uri) continue
        const resolved = resolveUrl(rendition.uri, baseUrl)
        out.push({
            id: `hls-text-${index++}-${rendition.groupId}-${rendition.name}`,
            kind: 'subtitles',
            language: rendition.language ?? null,
            label: rendition.name,
            default: rendition.default === true,
            uri: resolved,
            // HLS subtitle renditions don't carry a MIME type; WebVTT is the
            // overwhelmingly dominant format for sidecar HLS subtitles.
            mimeType: 'text/vtt',
            ...(parentDefines && { variables: parentDefines }),
        })
    }
    return out
}
