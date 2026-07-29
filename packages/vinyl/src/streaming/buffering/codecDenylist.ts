/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { extractCodecs } from '../../util/media/codecSupport'

/**
 * A runtime denylist of media codecs that failed to decode after a SourceBuffer
 * append, despite the browser reporting them as supported.
 *
 * Some browsers report a codec as supported via `MediaSource.isTypeSupported`
 * yet fail to decode it (e.g. HEVC on Chromium without a platform decoder),
 * surfacing as an append/decode error only once media is fed to the
 * SourceBuffer. When that happens, the failing codec is recorded here so that
 * quality selection avoids it and playback can fall back to a codec that does
 * decode.
 *
 * This mirrors the runtime {@link getSourceBufferQuota} learning: it is a
 * process-wide singleton learned from real append failures, with a reset hook
 * for tests and re-detection. Entries are the individual RFC 6381 codec
 * strings (e.g. `hvc1.2.20000000.L123.B0`), stored lowercased.
 */
const denylistedCodecs = new Set<string>()

/**
 * Records every codec in the given mimeType as denylisted. Returns true if any
 * codec was newly added (i.e. was not already denylisted), false if all codecs
 * were already present. The return value lets callers bound retry loops: a
 * repeat failure for an already-denylisted codec should not trigger another
 * fallback attempt.
 */
export function denylistCodecsFromMimeType(mimeType: string): boolean {
    const codecs = extractCodecs(mimeType)
    let added = false
    for (const codec of codecs) {
        const lower = codec.toLowerCase()
        if (!denylistedCodecs.has(lower)) {
            denylistedCodecs.add(lower)
            added = true
        }
    }
    return added
}

/**
 * Returns true when any codec in the given mimeType has been denylisted.
 */
export function isMimeTypeDenylisted(mimeType: string): boolean {
    const codecs = extractCodecs(mimeType)
    return codecs.some((c) => denylistedCodecs.has(c.toLowerCase()))
}

/**
 * Returns the currently denylisted codec strings (lowercased). Primarily for
 * diagnostics and testing.
 */
export function getDenylistedCodecs(): readonly string[] {
    return [...denylistedCodecs]
}

/**
 * Clears the runtime codec denylist. Intended for tests and for re-detecting
 * support (e.g. after an environment change).
 */
export function clearCodecDenylist(): void {
    denylistedCodecs.clear()
}
