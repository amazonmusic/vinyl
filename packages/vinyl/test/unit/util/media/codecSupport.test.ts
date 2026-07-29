/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { extractCodecs } from '@amazon/vinyl'

describe('codecSupport', () => {
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
})
