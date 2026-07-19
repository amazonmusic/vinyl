/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    extractCodecs,
    findFalseReport,
    isKnownFalseReport,
    KNOWN_CODEC_FALSE_REPORTS,
    type CodecFalseReport,
} from '@amazon/vinyl'
import { setUserAgent } from '@amazon/vinyl-util'

const CHROME_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const SAFARI_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'

describe('codecSupport', () => {
    afterEach(() => {
        setUserAgent('')
    })

    describe('extractCodecs', () => {
        it('extracts a single codec from a mimeType', () => {
            expect(extractCodecs('video/mp4; codecs="avc1.64001f"')).toEqual([
                'avc1.64001f',
            ])
        })

        it('extracts multiple comma-separated codecs', () => {
            expect(
                extractCodecs('video/mp4; codecs="avc1.64001f,mp4a.40.2"')
            ).toEqual(['avc1.64001f', 'mp4a.40.2'])
        })

        it('handles unquoted codecs', () => {
            expect(extractCodecs('audio/mp4; codecs=ac-3')).toEqual(['ac-3'])
        })

        it('returns empty when no codecs parameter is present', () => {
            expect(extractCodecs('video/mp4')).toEqual([])
        })

        it('trims whitespace around codecs', () => {
            expect(
                extractCodecs('video/mp4; codecs="hvc1.1 , mp4a.40.2"')
            ).toEqual(['hvc1.1', 'mp4a.40.2'])
        })
    })

    describe('findFalseReport', () => {
        it('flags HEVC (hvc1) on Chromium', () => {
            setUserAgent(CHROME_UA)
            const report = findFalseReport(
                'video/mp4; codecs="hvc1.2.20000000.L123.B0"'
            )
            expect(report?.id).toBe('chromium-hevc')
        })

        it('flags HEVC (hev1) on Chromium', () => {
            setUserAgent(CHROME_UA)
            const report = findFalseReport(
                'video/mp4; codecs="hev1.2.20000000.L123.B0"'
            )
            expect(report?.id).toBe('chromium-hevc')
        })

        it('does not flag HEVC on Safari', () => {
            setUserAgent(SAFARI_UA)
            expect(
                findFalseReport('video/mp4; codecs="hvc1.2.20000000.L123.B0"')
            ).toBeUndefined()
        })

        it('does not flag AVC on Chromium', () => {
            setUserAgent(CHROME_UA)
            expect(
                findFalseReport('video/mp4; codecs="avc1.64001f"')
            ).toBeUndefined()
        })

        it('flags HEVC when combined with other codecs', () => {
            setUserAgent(CHROME_UA)
            const report = findFalseReport(
                'video/mp4; codecs="hvc1.1,mp4a.40.2"'
            )
            expect(report?.id).toBe('chromium-hevc')
        })

        it('returns undefined for a mimeType with no codecs', () => {
            setUserAgent(CHROME_UA)
            expect(findFalseReport('video/mp4')).toBeUndefined()
        })

        it('honors a custom report list', () => {
            const custom: CodecFalseReport[] = [
                {
                    id: 'test-av1',
                    codecPattern: /^av01\b/i,
                    enabled: () => true,
                    reason: 'test',
                },
            ]
            expect(
                findFalseReport('video/mp4; codecs="av01.0.05M.08"', custom)?.id
            ).toBe('test-av1')
            // A codec not in the custom list is not flagged.
            expect(
                findFalseReport('video/mp4; codecs="hvc1.1"', custom)
            ).toBeUndefined()
        })

        it('skips a rule whose enabled test returns false', () => {
            const custom: CodecFalseReport[] = [
                {
                    id: 'disabled',
                    codecPattern: /^hvc1\b/i,
                    enabled: () => false,
                    reason: 'test',
                },
            ]
            expect(
                findFalseReport('video/mp4; codecs="hvc1.1"', custom)
            ).toBeUndefined()
        })
    })

    describe('isKnownFalseReport', () => {
        it('consults the current environment browser', () => {
            // In the test (jsdom/node) environment the UA is not Chromium-like
            // for these purposes, so the built-in denylist does not apply.
            setUserAgent(SAFARI_UA)
            const result = isKnownFalseReport('video/mp4; codecs="hvc1.1"')
            expect(typeof result).toBe('boolean')
            expect(result).toBeFalse()
        })

        it('flags a codec via a custom always-applies list', () => {
            const custom: CodecFalseReport[] = [
                {
                    id: 'always',
                    codecPattern: /^hvc1\b/i,
                    enabled: () => true,
                    reason: 'test',
                },
            ]
            expect(
                isKnownFalseReport('video/mp4; codecs="hvc1.1"', custom)
            ).toBeTrue()
        })
    })

    describe('KNOWN_CODEC_FALSE_REPORTS', () => {
        it('includes the Chromium HEVC rule', () => {
            expect(
                KNOWN_CODEC_FALSE_REPORTS.some((r) => r.id === 'chromium-hevc')
            ).toBeTrue()
        })
    })
})
