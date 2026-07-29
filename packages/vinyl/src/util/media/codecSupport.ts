/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Extracts the individual codec strings from a mimeType's `codecs=` parameter.
 * Returns an empty array when no codecs parameter is present.
 */
export function extractCodecs(mimeType: string): string[] {
    const match = /codecs\s*=\s*"?([^"]*)"?/i.exec(mimeType)
    if (!match || !match[1]) return []
    return match[1]
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c.length > 0)
}
