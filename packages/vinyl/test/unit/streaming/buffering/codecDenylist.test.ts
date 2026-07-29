/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    clearCodecDenylist,
    denylistCodecsFromMimeType,
    getDenylistedCodecs,
    isMimeTypeDenylisted,
} from '@amazon/vinyl'

describe('codecDenylist', () => {
    afterEach(() => {
        clearCodecDenylist()
    })

    describe('denylistCodecsFromMimeType', () => {
        it('adds codecs and returns true on first denylist', () => {
            expect(
                denylistCodecsFromMimeType('video/mp4; codecs="hvc1.1"')
            ).toBeTrue()
            expect(getDenylistedCodecs()).toContain('hvc1.1')
        })

        it('returns false when all codecs are already denylisted', () => {
            denylistCodecsFromMimeType('video/mp4; codecs="hvc1.1"')
            expect(
                denylistCodecsFromMimeType('video/mp4; codecs="hvc1.1"')
            ).toBeFalse()
        })

        it('returns true when at least one codec is newly added', () => {
            denylistCodecsFromMimeType('video/mp4; codecs="hvc1.1"')
            expect(
                denylistCodecsFromMimeType('video/mp4; codecs="hvc1.1,ec-3"')
            ).toBeTrue()
        })

        it('returns false for a mimeType with no codecs', () => {
            expect(denylistCodecsFromMimeType('video/mp4')).toBeFalse()
        })

        it('stores codecs lowercased', () => {
            denylistCodecsFromMimeType('video/mp4; codecs="HVC1.1"')
            expect(getDenylistedCodecs()).toContain('hvc1.1')
        })
    })

    describe('isMimeTypeDenylisted', () => {
        it('returns true when a codec is denylisted', () => {
            denylistCodecsFromMimeType('video/mp4; codecs="hvc1.1"')
            expect(
                isMimeTypeDenylisted('video/mp4; codecs="hvc1.1"')
            ).toBeTrue()
        })

        it('is case-insensitive', () => {
            denylistCodecsFromMimeType('video/mp4; codecs="hvc1.1"')
            expect(
                isMimeTypeDenylisted('video/mp4; codecs="HVC1.1"')
            ).toBeTrue()
        })

        it('returns false when no codec is denylisted', () => {
            denylistCodecsFromMimeType('video/mp4; codecs="hvc1.1"')
            expect(
                isMimeTypeDenylisted('video/mp4; codecs="avc1.64001f"')
            ).toBeFalse()
        })

        it('returns false for a mimeType with no codecs', () => {
            denylistCodecsFromMimeType('video/mp4; codecs="hvc1.1"')
            expect(isMimeTypeDenylisted('video/mp4')).toBeFalse()
        })
    })

    describe('clearCodecDenylist', () => {
        it('empties the denylist', () => {
            denylistCodecsFromMimeType('video/mp4; codecs="hvc1.1"')
            clearCodecDenylist()
            expect(getDenylistedCodecs()).toEqual([])
        })
    })
})
