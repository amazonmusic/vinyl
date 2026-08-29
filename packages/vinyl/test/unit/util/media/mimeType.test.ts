/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { mimeSubtype } from '@amazon/vinyl'

describe('mimeSubtype', () => {
    it('returns the subtype after the slash', () => {
        expect(mimeSubtype('audio/mp4')).toBe('mp4')
        expect(mimeSubtype('video/webm')).toBe('webm')
    })

    it('ignores codec and other parameters', () => {
        expect(mimeSubtype('video/webm; codecs="vp9"')).toBe('webm')
        expect(mimeSubtype('audio/mp4;codecs="mp4a.40.2"')).toBe('mp4')
    })

    it('lowercases and trims', () => {
        expect(mimeSubtype('  VIDEO/MP4 ; codecs="avc1"')).toBe('mp4')
    })

    it('returns an empty string when there is no subtype', () => {
        expect(mimeSubtype('video')).toBe('')
        expect(mimeSubtype('')).toBe('')
    })
})
