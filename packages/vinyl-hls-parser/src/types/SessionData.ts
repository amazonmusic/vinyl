/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Session-level metadata in an HLS Master Playlist (EXT-X-SESSION-DATA).
 *
 * Carries application-defined key/value data that applies to the entire presentation,
 * such as content identifiers or localized metadata.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8216#section-4.3.4.4
 */
export interface SessionData {
    /** A unique identifier for this session data entry (DATA-ID). */
    readonly dataId: string

    /** The data value as a string (VALUE). Mutually exclusive with {@link uri}. */
    readonly value?: string

    /** A URI pointing to a JSON resource containing the data (URI). Mutually exclusive with {@link value}. */
    readonly uri?: string

    /** The language of the data as a BCP 47 tag (LANGUAGE). */
    readonly language?: string
}
