/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TrackTypeId } from '../track/Track'

/**
 * Infers the track type from a URI based on its file extension.
 * Returns null if the type cannot be determined.
 */
export function inferTrackType(uri: string): TrackTypeId | null {
    if (uri.endsWith('.m3u8') || uri.includes('.m3u8?')) return 'hls'
    if (uri.endsWith('.mpd') || uri.includes('.mpd?')) return 'dash'
    if (/\.(mp3|mp4|m4a|m4v|aac|ogg|opus|wav|webm)(\?|$)/i.test(uri))
        return 'src'
    return null
}
