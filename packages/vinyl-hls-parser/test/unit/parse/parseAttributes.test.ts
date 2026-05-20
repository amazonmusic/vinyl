/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { StringReader } from '@amazon/vinyl-util'
import { parseAttributes } from '@amazon/vinyl-hls-parser'

describe('parseAttributes', () => {
    it('parses simple key-value pairs', () => {
        const reader = new StringReader(
            'BANDWIDTH=1280000,CODECS="avc1.42e00a"'
        )
        const attrs = parseAttributes(reader)
        expect(attrs['BANDWIDTH']).toBe('1280000')
        expect(attrs['CODECS']).toBe('avc1.42e00a')
    })

    it('handles quoted values with embedded commas', () => {
        const reader = new StringReader(
            'CODECS="avc1.42e00a,mp4a.40.2",BANDWIDTH=1280000'
        )
        const attrs = parseAttributes(reader)
        expect(attrs['CODECS']).toBe('avc1.42e00a,mp4a.40.2')
        expect(attrs['BANDWIDTH']).toBe('1280000')
    })

    it('handles a single unquoted attribute', () => {
        const reader = new StringReader('BANDWIDTH=1280000')
        const attrs = parseAttributes(reader)
        expect(attrs['BANDWIDTH']).toBe('1280000')
    })

    it('handles a single quoted attribute', () => {
        const reader = new StringReader('URI="segment.ts"')
        const attrs = parseAttributes(reader)
        expect(attrs['URI']).toBe('segment.ts')
    })

    it('returns empty record for empty input', () => {
        const reader = new StringReader('')
        const attrs = parseAttributes(reader)
        expect(Object.keys(attrs).length).toBe(0)
    })

    it('handles multiple quoted values', () => {
        const reader = new StringReader(
            'TYPE=AUDIO,GROUP-ID="audio",NAME="English",LANGUAGE="en"'
        )
        const attrs = parseAttributes(reader)
        expect(attrs['TYPE']).toBe('AUDIO')
        expect(attrs['GROUP-ID']).toBe('audio')
        expect(attrs['NAME']).toBe('English')
        expect(attrs['LANGUAGE']).toBe('en')
    })

    it('skips empty key', () => {
        const reader = new StringReader('=value,KEY=test')
        const attrs = parseAttributes(reader)
        expect(Object.keys(attrs).length).toBe(0)
    })

    it('handles missing equals sign', () => {
        const reader = new StringReader('NOEQUALS')
        const attrs = parseAttributes(reader)
        expect(Object.keys(attrs).length).toBe(0)
    })

    it('handles quoted value without closing quote', () => {
        const reader = new StringReader('KEY="unclosed')
        const attrs = parseAttributes(reader)
        expect(attrs['KEY']).toBe('unclosed')
    })

    it('stops at newline', () => {
        const reader = new StringReader('KEY=value\nIGNORED=ignored')
        const attrs = parseAttributes(reader)
        expect(attrs['KEY']).toBe('value')
        expect(attrs['IGNORED']).toBeUndefined()
    })

    it('stops at carriage return', () => {
        const reader = new StringReader('KEY=value\rIGNORED=ignored')
        const attrs = parseAttributes(reader)
        expect(attrs['KEY']).toBe('value')
        expect(attrs['IGNORED']).toBeUndefined()
    })
})
