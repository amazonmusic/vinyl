/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EncryptionKey } from './EncryptionKey'

export type HlsByteRange = { readonly length: number; readonly offset: number }

/**
 * A media segment in an HLS Media Playlist (EXTINF).
 *
 * Each segment represents a contiguous chunk of media that can be fetched and decoded independently.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8216#section-4.3.2
 */
export interface HlsSegment {
    /** The URI of the media segment resource. */
    readonly uri: string

    /** The duration of the segment in seconds (EXTINF). */
    readonly duration: number

    /** The media sequence number of this segment, derived from EXT-X-MEDIA-SEQUENCE and segment position. */
    readonly sequenceNumber: number

    /** The encryption key applied to this segment (EXT-X-KEY), if any. */
    readonly key?: EncryptionKey

    /** The initialization segment (EXT-X-MAP) required to decode this segment, if any. */
    readonly map?: HlsMap

    /** A sub-range of the segment resource to fetch (EXT-X-BYTERANGE), if any. */
    readonly byteRange?: HlsByteRange

    /** Whether this segment begins a new discontinuity sequence (EXT-X-DISCONTINUITY). */
    readonly discontinuity: boolean

    /** An absolute date/time corresponding to the start of this segment (EXT-X-PROGRAM-DATE-TIME), if any. */
    readonly programDateTime?: string
}

/**
 * An initialization segment (EXT-X-MAP) that contains media initialization data such as
 * the fMP4 moov box required to initialize a decoder before processing media segments.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8216#section-4.3.2.5
 */
export interface HlsMap {
    /** The URI of the initialization segment resource. */
    readonly uri: string

    /** A sub-range of the initialization segment resource to fetch, if any. */
    readonly byteRange?: { readonly length: number; readonly offset: number }
}
