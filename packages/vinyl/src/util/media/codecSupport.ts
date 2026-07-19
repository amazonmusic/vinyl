/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Browser, hasBrowser } from '@amazon/vinyl-util'

/**
 * Known browsers misreport codec support: `MediaSource.isTypeSupported`
 * (and `HTMLMediaElement.canPlayType`) return `true` for a codec the browser
 * cannot actually decode, so a segment append later fails with a decode error.
 *
 * This module maintains a denylist of such false-positive codecs and applies
 * it on top of the browser's support check, so support detection reflects what
 * will actually play rather than what the browser claims.
 *
 * The list is intentionally conservative: an entry should only be added when a
 * codec is known to pass `isTypeSupported` yet fail to decode on a real
 * browser/platform, and it is scoped by an {@link CodecFalseReport.enabled}
 * test so browsers that genuinely support the codec are unaffected.
 */

/**
 * A single known-false-report rule. A codec matched by {@link codecPattern} is
 * treated as unsupported when {@link enabled} returns true for the current
 * environment.
 */
export interface CodecFalseReport {
    /**
     * A short identifier for the rule, used in diagnostics.
     */
    readonly id: string

    /**
     * Matches the RFC 6381 codec string(s) this rule applies to (tested against
     * each codec in a mimeType's `codecs=` list, case-insensitively).
     */
    readonly codecPattern: RegExp

    /**
     * Returns true when this rule should apply to the current environment.
     * Keeping the scope narrow (e.g. via {@link hasBrowser}) avoids denying a
     * codec on browsers that really support it.
     */
    readonly enabled: () => boolean

    /**
     * Human-readable reason, for diagnostics.
     */
    readonly reason: string
}

/**
 * The built-in denylist of known browser false codec reports.
 *
 * HEVC on Chromium: Chromium reports `isTypeSupported('video/mp4;
 * codecs="hvc1…"/"hev1…"')` as `true` on builds with no platform HEVC decoder
 * (e.g. Chrome for Testing, many Linux/Windows configs without hardware
 * support). MSE appends then fail with `CHUNK_DEMUXER_ERROR_APPEND_FAILED`.
 * Chrome only decodes HEVC when the OS provides a decoder, which the static
 * support check does not reflect. Safari (which genuinely decodes HEVC) is not
 * matched by {@link hasBrowser} for {@link Browser.CHROMIUM}, so it is
 * unaffected.
 */
export const KNOWN_CODEC_FALSE_REPORTS: readonly CodecFalseReport[] = [
    {
        id: 'chromium-hevc',
        codecPattern: /^(hvc1|hev1)\b/i,
        enabled: () => hasBrowser(Browser.CHROMIUM),
        reason: 'Chromium reports HEVC as supported but cannot decode it without a platform decoder',
    },
]

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

/**
 * Returns the {@link CodecFalseReport} that flags any codec in the given
 * mimeType as a known false positive for the current environment, or undefined
 * if none apply. Exported for diagnostics and testing; callers normally use
 * {@link isKnownFalseReport}.
 */
export function findFalseReport(
    mimeType: string,
    reports: readonly CodecFalseReport[] = KNOWN_CODEC_FALSE_REPORTS
): CodecFalseReport | undefined {
    const codecs = extractCodecs(mimeType)
    if (codecs.length === 0) return undefined
    for (const report of reports) {
        if (!report.enabled()) continue
        if (codecs.some((c) => report.codecPattern.test(c))) return report
    }
    return undefined
}

/**
 * Returns true when the given mimeType contains a codec known to be falsely
 * reported as supported by the current environment, and should therefore be
 * treated as unsupported regardless of what the browser's support check says.
 */
export function isKnownFalseReport(
    mimeType: string,
    reports: readonly CodecFalseReport[] = KNOWN_CODEC_FALSE_REPORTS
): boolean {
    return findFalseReport(mimeType, reports) !== undefined
}
