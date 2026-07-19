/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolveCodecOverride } from '@amazon/vinyl'

describe('codecOverrides', () => {
    describe('resolveCodecOverride', () => {
        it('returns undefined when overrides are undefined', () => {
            expect(
                resolveCodecOverride('video/mp4; codecs="hvc1.1"', undefined)
            ).toBeUndefined()
        })

        it('returns undefined when overrides are empty', () => {
            expect(
                resolveCodecOverride('video/mp4; codecs="hvc1.1"', {})
            ).toBeUndefined()
        })

        it('returns undefined when no key matches', () => {
            expect(
                resolveCodecOverride('video/mp4; codecs="avc1.64001f"', {
                    hvc1: 'deny',
                })
            ).toBeUndefined()
        })

        it('matches a codec by prefix', () => {
            expect(
                resolveCodecOverride(
                    'video/mp4; codecs="hvc1.2.20000000.L123.B0"',
                    { hvc1: 'deny' }
                )
            ).toBe('deny')
        })

        it('resolves an allow', () => {
            expect(
                resolveCodecOverride('video/mp4; codecs="av01.0.05M.08"', {
                    av01: 'allow',
                })
            ).toBe('allow')
        })

        it('is case-insensitive on the key', () => {
            expect(
                resolveCodecOverride('video/mp4; codecs="HVC1.1"', {
                    hvc1: 'deny',
                })
            ).toBe('deny')
        })

        it('deny wins over allow across multiple codecs', () => {
            expect(
                resolveCodecOverride('video/mp4; codecs="hvc1.1,mp4a.40.2"', {
                    mp4a: 'allow',
                    hvc1: 'deny',
                })
            ).toBe('deny')
        })

        it('returns undefined when the mimeType has no codecs', () => {
            expect(
                resolveCodecOverride('video/mp4', { hvc1: 'deny' })
            ).toBeUndefined()
        })
    })
})
