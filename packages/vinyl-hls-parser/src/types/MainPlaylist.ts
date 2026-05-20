/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AlternativeRendition } from './AlternativeRendition'
import type { SessionData } from './SessionData'
import type { VariantStream } from './VariantStream'

/**
 * A parsed HLS Master Playlist (also called Multivariant Playlist) as defined by RFC 8216.
 *
 * A Master Playlist provides a set of variant streams, each representing the same content at
 * different bitrates or resolutions, along with alternative renditions and session-level metadata.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8216#section-4.3.4
 */
export interface MainPlaylist {
    /** The variant streams available in this presentation (EXT-X-STREAM-INF). */
    readonly variants: readonly VariantStream[]

    /** Alternative renditions such as additional audio languages or subtitles (EXT-X-MEDIA). */
    readonly alternativeRenditions: readonly AlternativeRendition[]

    /** Session-level key/value metadata (EXT-X-SESSION-DATA). */
    readonly sessionData: readonly SessionData[]

    /** Variables defined via EXT-X-DEFINE. Keys are variable names, values are their resolved values. */
    readonly defines?: Readonly<Record<string, string>>
}
