/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    IllegalArgumentError,
    StringParseError,
    substitute,
} from '@amazon/vinyl-util'
import {
    parseMediaPlaylist,
    HLS_VARIABLE_PATTERN,
} from '@amazon/vinyl-hls-parser'

describe('parseMediaPlaylist', () => {
    it('throws StringParseError when #EXTM3U is missing', () => {
        expect(() => parseMediaPlaylist('invalid')).toThrowError(
            StringParseError
        )
    })

    it('parses segments with uri, duration, and sequenceNumber', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-TARGETDURATION:10',
            '#EXTINF:9.009,',
            'segment0.ts',
            '#EXTINF:9.009,',
            'segment1.ts',
            '#EXTINF:3.003,',
            'segment2.ts',
        ].join('\n')

        const result = parseMediaPlaylist(manifest)
        expect(result.segments.length).toBe(3)
        expect(result.segments[0].uri).toBe('segment0.ts')
        expect(result.segments[0].duration).toBe(9.009)
        expect(result.segments[0].sequenceNumber).toBe(0)
        expect(result.segments[1].sequenceNumber).toBe(1)
        expect(result.segments[2].sequenceNumber).toBe(2)
    })

    it('parses target duration', () => {
        const manifest = '#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:9,\nseg.ts'
        const result = parseMediaPlaylist(manifest)
        expect(result.targetDuration).toBe(10)
    })

    it('uses media sequence as starting sequence number', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-MEDIA-SEQUENCE:100',
            '#EXTINF:9,',
            'segment0.ts',
            '#EXTINF:9,',
            'segment1.ts',
        ].join('\n')

        const result = parseMediaPlaylist(manifest)
        expect(result.mediaSequence).toBe(100)
        expect(result.segments[0].sequenceNumber).toBe(100)
        expect(result.segments[1].sequenceNumber).toBe(101)
    })

    it('sets ended to true when #EXT-X-ENDLIST is present', () => {
        const manifest = '#EXTM3U\n#EXTINF:9,\nseg.ts\n#EXT-X-ENDLIST'
        const result = parseMediaPlaylist(manifest)
        expect(result.ended).toBe(true)
    })

    it('sets ended to false when #EXT-X-ENDLIST is absent', () => {
        const manifest = '#EXTM3U\n#EXTINF:9,\nseg.ts'
        const result = parseMediaPlaylist(manifest)
        expect(result.ended).toBe(false)
    })

    describe('when #EXT-X-PLAYLIST-TYPE is present', () => {
        it('parses VOD type', () => {
            const manifest =
                '#EXTM3U\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXTINF:9,\nseg.ts'
            const result = parseMediaPlaylist(manifest)
            expect(result.playlistType).toBe('VOD')
        })

        it('parses EVENT type', () => {
            const manifest =
                '#EXTM3U\n#EXT-X-PLAYLIST-TYPE:EVENT\n#EXTINF:9,\nseg.ts'
            const result = parseMediaPlaylist(manifest)
            expect(result.playlistType).toBe('EVENT')
        })
    })

    it('defaults playlistType to LIVE when absent', () => {
        const manifest = '#EXTM3U\n#EXTINF:9,\nseg.ts'
        const result = parseMediaPlaylist(manifest)
        expect(result.playlistType).toBe('LIVE')
    })

    it('parses version number', () => {
        const manifest = '#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:9,\nseg.ts'
        const result = parseMediaPlaylist(manifest)
        expect(result.version).toBe(3)
    })

    it('defaults version to 1 when absent', () => {
        const manifest = '#EXTM3U\n#EXTINF:9,\nseg.ts'
        const result = parseMediaPlaylist(manifest)
        expect(result.version).toBe(1)
    })

    it('parses segments with relative URIs', () => {
        const manifest = '#EXTM3U\n#EXTINF:9,\nsegment.ts'
        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].uri).toBe('segment.ts')
    })

    it('handles EXT-X-PROGRAM-DATE-TIME between EXTINF and URI', () => {
        const manifest = `#EXTM3U
#EXTINF:10.0,
#EXT-X-PROGRAM-DATE-TIME:2023-01-01T00:00:00Z
segment.ts`
        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].programDateTime).toBe('2023-01-01T00:00:00Z')
    })

    it('handles EXT-X-DISCONTINUITY between EXTINF and URI', () => {
        const manifest = `#EXTM3U
#EXTINF:10.0,
#EXT-X-DISCONTINUITY
segment.ts`
        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].discontinuity).toBe(true)
    })

    it('handles EXT-X-BYTERANGE without offset between EXTINF and URI', () => {
        const manifest = `#EXTM3U
#EXTINF:10.0,
#EXT-X-BYTERANGE:1000000
segment.ts`
        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].byteRange?.length).toBe(1000000)
        expect(result.segments[0].byteRange?.offset).toBe(0)
    })

    it('handles EXTINF without URI at end of file', () => {
        const manifest = `#EXTM3U
#EXTINF:10.0,`
        const result = parseMediaPlaylist(manifest)
        expect(result.segments.length).toBe(1)
        expect(result.segments[0].uri).toBe('')
    })

    it('handles EXTINF with whitespace before URI', () => {
        const manifest = `#EXTM3U
#EXTINF:10.0,
   
segment.ts`
        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].uri).toBe('segment.ts')
    })

    it('handles unknown tag between EXTINF and URI', () => {
        const manifest = `#EXTM3U
#EXTINF:10.0,
#EXT-X-UNKNOWN-TAG:value
segment.ts`
        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].uri).toBe('segment.ts')
    })

    it('handles empty media playlist', () => {
        const manifest = '#EXTM3U'
        const result = parseMediaPlaylist(manifest)
        expect(result.segments.length).toBe(0)
    })

    it('handles line with only whitespace in media playlist', () => {
        const manifest = `#EXTM3U
#EXT-X-TARGETDURATION:10
   
#EXTINF:10.0,
segment.ts`
        const result = parseMediaPlaylist(manifest)
        expect(result.segments.length).toBe(1)
        expect(result.targetDuration).toBe(10)
    })

    it('handles EXT-X-BYTERANGE with offset in existing test', () => {
        // This test already exists in the integration tests, but let's ensure
        // we test the parts.length > 1 branch explicitly
        const manifest = `#EXTM3U
#EXTINF:10.0,
#EXT-X-BYTERANGE:1000000@500000
segment.ts`
        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].byteRange?.length).toBe(1000000)
        expect(result.segments[0].byteRange?.offset).toBe(500000)
    })

    it('handles line that becomes empty after trimming in media playlist', () => {
        // Create a line with non-breaking space
        const manifest = '#EXTM3U\n\u00A0\n#EXTINF:10.0,\nsegment.ts'
        const result = parseMediaPlaylist(manifest)
        expect(result.segments.length).toBe(1)
    })

    describe('when #EXT-X-KEY is present', () => {
        it('attaches encryption key to segments', () => {
            const manifest = [
                '#EXTM3U',
                '#EXT-X-KEY:METHOD=AES-128,URI="key.bin",IV=0x00000001,KEYFORMAT="identity",KEYFORMATVERSIONS="1"',
                '#EXTINF:9,',
                'seg0.ts',
            ].join('\n')

            const result = parseMediaPlaylist(manifest)
            const key = result.segments[0].key!
            expect(key.method).toBe('AES-128')
            expect(key.uri).toBe('key.bin')
            expect(key.iv).toBe('0x00000001')
            expect(key.keyFormat).toBe('identity')
            expect(key.keyFormatVersions).toBe('1')
        })

        it('supports key rotation across segments', () => {
            const manifest = [
                '#EXTM3U',
                '#EXT-X-KEY:METHOD=AES-128,URI="key1.bin"',
                '#EXTINF:9,',
                'seg0.ts',
                '#EXTINF:9,',
                'seg1.ts',
                '#EXT-X-KEY:METHOD=AES-128,URI="key2.bin"',
                '#EXTINF:9,',
                'seg2.ts',
            ].join('\n')

            const result = parseMediaPlaylist(manifest)
            expect(result.segments[0].key!.uri).toBe('key1.bin')
            expect(result.segments[1].key!.uri).toBe('key1.bin')
            expect(result.segments[2].key!.uri).toBe('key2.bin')
        })
    })

    it('parses byte range with length and offset', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-BYTERANGE:75232@0',
            '#EXTINF:9,',
            'seg.ts',
        ].join('\n')

        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].byteRange!.length).toBe(75232)
        expect(result.segments[0].byteRange!.offset).toBe(0)
    })

    it('defaults byte range offset to 0 when omitted', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-BYTERANGE:75232',
            '#EXTINF:9,',
            'seg.ts',
        ].join('\n')

        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].byteRange!.length).toBe(75232)
        expect(result.segments[0].byteRange!.offset).toBe(0)
    })

    it('marks segment with discontinuity', () => {
        const manifest = [
            '#EXTM3U',
            '#EXTINF:9,',
            'seg0.ts',
            '#EXT-X-DISCONTINUITY',
            '#EXTINF:9,',
            'seg1.ts',
            '#EXTINF:9,',
            'seg2.ts',
        ].join('\n')

        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].discontinuity).toBe(false)
        expect(result.segments[1].discontinuity).toBe(true)
        expect(result.segments[2].discontinuity).toBe(false)
    })

    it('parses program date-time', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-PROGRAM-DATE-TIME:2024-01-01T00:00:00.000Z',
            '#EXTINF:9,',
            'seg0.ts',
            '#EXTINF:9,',
            'seg1.ts',
        ].join('\n')

        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].programDateTime).toBe(
            '2024-01-01T00:00:00.000Z'
        )
        expect(result.segments[1].programDateTime).toBeUndefined()
    })

    it('skips blank lines and comments', () => {
        const manifest = [
            '#EXTM3U',
            '',
            '# comment',
            '#EXTINF:9,',
            'seg.ts',
        ].join('\n')

        const result = parseMediaPlaylist(manifest)
        expect(result.segments.length).toBe(1)
    })

    it('parses #EXT-X-MAP with URI', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-MAP:URI="init.mp4"',
            '#EXTINF:9,',
            'seg.ts',
        ].join('\n')

        const result = parseMediaPlaylist(manifest)
        expect(result.segments.length).toBe(1)
        expect(result.segments[0].map).toEqual({ uri: 'init.mp4' })
    })

    it('parses #EXT-X-MAP with URI and BYTERANGE', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-MAP:URI="main.mp4",BYTERANGE="812@0"',
            '#EXTINF:9,',
            'seg.ts',
        ].join('\n')

        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].map).toEqual({
            uri: 'main.mp4',
            byteRange: { length: 812, offset: 0 },
        })
    })

    it('#EXT-X-MAP persists across segments', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-MAP:URI="init.mp4"',
            '#EXTINF:9,',
            'seg0.ts',
            '#EXTINF:9,',
            'seg1.ts',
        ].join('\n')

        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].map?.uri).toBe('init.mp4')
        expect(result.segments[1].map?.uri).toBe('init.mp4')
    })

    it('#EXT-X-MAP can be replaced by a later #EXT-X-MAP', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-MAP:URI="init1.mp4"',
            '#EXTINF:9,',
            'seg0.ts',
            '#EXT-X-MAP:URI="init2.mp4"',
            '#EXTINF:9,',
            'seg1.ts',
        ].join('\n')

        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].map?.uri).toBe('init1.mp4')
        expect(result.segments[1].map?.uri).toBe('init2.mp4')
    })

    it('segment has no map when #EXT-X-MAP is absent', () => {
        const manifest = '#EXTM3U\n#EXTINF:9,\nseg.ts'
        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].map).toBeUndefined()
    })

    it('handles #EXT-X-MAP between EXTINF and URI', () => {
        const manifest = [
            '#EXTM3U',
            '#EXTINF:9,',
            '#EXT-X-MAP:URI="init.mp4",BYTERANGE="812@0"',
            'seg.ts',
        ].join('\n')

        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].map).toEqual({
            uri: 'init.mp4',
            byteRange: { length: 812, offset: 0 },
        })
    })

    it('handles segment without encryption key', () => {
        const manifest = '#EXTM3U\n#EXTINF:9,\nseg.ts'
        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].key).toBeUndefined()
    })

    it('handles segment without byte range', () => {
        const manifest = '#EXTM3U\n#EXTINF:9,\nseg.ts'
        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].byteRange).toBeUndefined()
    })

    it('byte range applies only to the immediately following segment', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-BYTERANGE:75232@0',
            '#EXTINF:9,',
            'seg0.ts',
            '#EXTINF:9,',
            'seg1.ts',
        ].join('\n')

        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].byteRange).toBeDefined()
        expect(result.segments[1].byteRange).toBeUndefined()
    })

    it('program date-time applies only to the immediately following segment', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-PROGRAM-DATE-TIME:2024-01-01T00:00:00.000Z',
            '#EXTINF:9,',
            'seg0.ts',
            '#EXTINF:9,',
            'seg1.ts',
        ].join('\n')

        const result = parseMediaPlaylist(manifest)
        expect(result.segments[0].programDateTime).toBeDefined()
        expect(result.segments[1].programDateTime).toBeUndefined()
    })

    it('substitutes variables in segment URIs when provided', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-TARGETDURATION:6',
            '#EXTINF:6.0,',
            '{$prefix}segment0.ts',
            '#EXT-X-ENDLIST',
        ].join('\n')
        const result = parseMediaPlaylist(manifest, {
            prefix: 'https://cdn.example.com/',
        })
        expect(result.segments[0].uri).toBe(
            'https://cdn.example.com/segment0.ts'
        )
    })
})

describe('substituteVariables', () => {
    it('replaces variable references', () => {
        expect(
            substitute(
                '{$host}/path',
                {
                    host: 'https://cdn.example.com',
                },
                HLS_VARIABLE_PATTERN
            )
        ).toBe('https://cdn.example.com/path')
    })

    it('throws IllegalArgumentError for undefined variables', () => {
        expect(() =>
            substitute('{$unknown}/path', {}, HLS_VARIABLE_PATTERN)
        ).toThrowError(IllegalArgumentError)
    })

    it('replaces multiple variables', () => {
        expect(
            substitute('{$a}/{$b}', { a: 'x', b: 'y' }, HLS_VARIABLE_PATTERN)
        ).toBe('x/y')
    })

    it('returns string unchanged when no variables', () => {
        expect(substitute('no-vars', {}, HLS_VARIABLE_PATTERN)).toBe('no-vars')
    })
})
