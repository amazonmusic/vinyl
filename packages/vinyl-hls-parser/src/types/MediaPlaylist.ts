/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DateRange } from './DateRange'
import type { HlsSegment } from './HlsSegment'

/**
 * A parsed HLS Media Playlist as defined by RFC 8216.
 *
 * A Media Playlist contains a list of media segments that, when played sequentially, form a continuous stream.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8216#section-4
 */
export interface MediaPlaylist {
    /** The HLS protocol version required by this playlist (EXT-X-VERSION). */
    readonly version: number

    /** The upper bound on the duration of any segment in the playlist, in seconds (EXT-X-TARGETDURATION). */
    readonly targetDuration: number

    /** The sequence number of the first segment in the playlist (EXT-X-MEDIA-SEQUENCE). */
    readonly mediaSequence: number

    /** The mutability type of the playlist: VOD (static), EVENT (append-only), or LIVE (sliding window). */
    readonly playlistType: MediaPlaylistType

    /** Whether the playlist is complete, indicated by the presence of EXT-X-ENDLIST. */
    readonly ended: boolean

    /** The ordered list of media segments in this playlist. */
    readonly segments: readonly HlsSegment[]

    /**
     * The Date Ranges declared in this playlist (EXT-X-DATERANGE), in the order
     * they appear. HLS Interstitials (SGAI ad breaks) are carried as Date Ranges
     * whose classId is `com.apple.hls.interstitial`.
     */
    readonly dateRanges: readonly DateRange[]
}

/** The mutability type of Media Playlist. */
export type MediaPlaylistType = 'VOD' | 'EVENT' | 'LIVE'
