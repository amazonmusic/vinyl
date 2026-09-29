/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    HlsMainPlaylist,
    HlsMediaPlaylist,
} from '@amazon/vinyl-hls-parser'

export interface HlsManifestData {
    /**
     * The main HLS playlist manifest.
     * Use getMediaPlaylist to resolve bitrate manifests.
     */
    readonly mainPlaylist: HlsMainPlaylist

    /**
     * The URL to be used for relative requests. Guaranteed to be absolute.
     *
     * Media with relative paths in the manifests will be resolved relative to this URL.
     */
    readonly baseUrl: string

    /**
     * Lazily fetches and caches a media playlist by variant URI.
     */
    readonly getMediaPlaylist: (uri: string) => Promise<HlsMediaPlaylistData>
}

/**
 * A media playlist with the URL its relative URIs resolve against.
 */
export interface HlsMediaPlaylistData extends HlsMediaPlaylist {
    /**
     * The media playlist's URL after redirects, against which its segment, map,
     * and date range URIs resolve. Guaranteed to be absolute when set.
     *
     * When absent, the variant URI resolved against
     * {@link HlsManifestData.baseUrl} is used instead.
     */
    readonly baseUrl?: string
}
