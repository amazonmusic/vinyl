/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Extracts the container subtype from a MIME type, lowercased — the portion
 * after the `/`, ignoring any parameters. For example
 * `video/webm; codecs="vp9"` → `webm` and `audio/mp4` → `mp4`. Returns an empty
 * string when the MIME type has no subtype.
 */
export function mimeSubtype(mimeType: string): string {
    return mimeType.split(';', 1)[0].trim().toLowerCase().split('/')[1] ?? ''
}
