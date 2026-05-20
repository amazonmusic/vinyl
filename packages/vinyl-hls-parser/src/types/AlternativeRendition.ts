/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ValueSchema } from '@amazon/vinyl-validation'
import { isOneOf } from '@amazon/vinyl-validation'

/**
 * An alternative rendition defined by EXT-X-MEDIA in an HLS Master Playlist.
 *
 * Alternative renditions allow a presentation to offer multiple versions of the same content,
 * such as audio in different languages or subtitles, that can be selected independently of the
 * variant stream.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8216#section-4.3.4.1
 */
export interface AlternativeRendition {
    /** The media type of this rendition (AUDIO, VIDEO, SUBTITLES, or CLOSED-CAPTIONS). */
    readonly type: RenditionType

    /** The group to which this rendition belongs (GROUP-ID). Variants reference groups to associate renditions. */
    readonly groupId: string

    /** A human-readable description of this rendition (NAME). */
    readonly name: string

    /** The URI of the Media Playlist for this rendition. Absent for CLOSED-CAPTIONS or when muxed into the variant. */
    readonly uri?: string

    /** The primary language of this rendition as a BCP 47 tag (LANGUAGE). */
    readonly language?: string

    /** Whether this rendition should be played when the user has not expressed a preference (DEFAULT). */
    readonly default?: boolean

    /** Whether the client may choose to play this rendition without explicit user selection (AUTOSELECT). */
    readonly autoSelect?: boolean
}

/**
 * The media type of an alternative rendition (EXT-X-MEDIA TYPE attribute).
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8216#section-4.3.4.1
 */
export type RenditionType = 'AUDIO' | 'VIDEO' | 'SUBTITLES' | 'CLOSED-CAPTIONS'

export const renditionTypeValidator: ValueSchema<RenditionType> = isOneOf(
    'AUDIO',
    'VIDEO',
    'SUBTITLES',
    'CLOSED-CAPTIONS'
)
