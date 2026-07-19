/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { extractCodecs } from './codecSupport'

/**
 * An explicit application-provided decision to allow or deny a codec,
 * bypassing the browser's support detection.
 *
 *  - `'allow'` forces the codec to be treated as supported even if the browser
 *    reports it unsupported (e.g. to opt in to a codec the app knows the
 *    platform can decode via an external path).
 *  - `'deny'` forces the codec to be treated as unsupported even if the browser
 *    reports it supported (e.g. to work around a browser that falsely claims
 *    support, or to exclude a codec by policy).
 */
export type CodecOverride = 'allow' | 'deny'

/**
 * Explicit codec allow/deny overrides. Keys are RFC 6381 codec strings or
 * prefixes (matched case-insensitively against the start of each codec in a
 * mimeType's `codecs=` list, so `"hvc1"` matches `"hvc1.2.20000000.L123.B0"`).
 *
 * An override supersedes the browser's support detection entirely. When a
 * mimeType contains multiple codecs, a `'deny'` on any of them denies the
 * mimeType; an `'allow'` applies only when no codec is denied.
 */
export type CodecOverrides = Readonly<Record<string, CodecOverride>>

/**
 * Resolves the effective override decision for a mimeType against a set of
 * {@link CodecOverrides}, or undefined when no override applies (in which case
 * the caller should fall back to normal support detection).
 *
 * A `'deny'` on any contained codec wins over an `'allow'` on another, so an
 * explicit deny is never silently overridden by an allow elsewhere in the
 * mimeType.
 */
export function resolveCodecOverride(
    mimeType: string,
    overrides: CodecOverrides | undefined
): CodecOverride | undefined {
    if (!overrides) return undefined
    const entries = Object.entries(overrides)
    if (entries.length === 0) return undefined

    const codecs = extractCodecs(mimeType)
    if (codecs.length === 0) return undefined

    let sawAllow = false
    for (const codec of codecs) {
        const lower = codec.toLowerCase()
        for (const [key, decision] of entries) {
            if (!lower.startsWith(key.toLowerCase())) continue
            // A deny anywhere wins immediately; otherwise remember the allow.
            if (decision === 'deny') return 'deny'
            sawAllow = true
        }
    }
    return sawAllow ? 'allow' : undefined
}
