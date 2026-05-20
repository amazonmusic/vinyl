/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReadonlyAbort } from '@amazon/vinyl-util'
import type { MainPlaylist, MediaPlaylist } from '@amazon/vinyl-hls-parser'

export type HlsManifestProvider = (
    abort?: ReadonlyAbort
) => Promise<HlsManifestData>

export interface HlsManifestData {
    /**
     * The main HLS playlist manifest.
     * Use getMediaPlaylist to resolve bitrate manifests.
     */
    readonly mainPlaylist: MainPlaylist

    /**
     * The URL to be used for relative requests. Guaranteed to be absolute.
     *
     * Media with relative paths in the manifests will be resolved relative to this URL.
     */
    readonly baseUrl: string

    /**
     * Lazily fetches and caches a media playlist by variant URI.
     */
    readonly getMediaPlaylist: (uri: string) => Promise<MediaPlaylist>
}
