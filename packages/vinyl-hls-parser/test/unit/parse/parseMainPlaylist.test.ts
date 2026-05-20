/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { StringParseError, ValidationError } from '@amazon/vinyl-util'
import { parseMainPlaylist } from '@amazon/vinyl-hls-parser'

describe('parseMainPlaylist', () => {
    it('throws StringParseError when #EXTM3U is missing', () => {
        expect(() => parseMainPlaylist('invalid')).toThrowError(
            StringParseError
        )
    })

    it('parses variant streams with bandwidth and uri', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-STREAM-INF:BANDWIDTH=1280000',
            'low/index.m3u8',
            '#EXT-X-STREAM-INF:BANDWIDTH=2560000',
            'mid/index.m3u8',
        ].join('\n')

        const result = parseMainPlaylist(manifest)
        expect(result.variants.length).toBe(2)
        expect(result.variants[0].bandwidth).toBe(1280000)
        expect(result.variants[0].uri).toBe('low/index.m3u8')
        expect(result.variants[1].bandwidth).toBe(2560000)
        expect(result.variants[1].uri).toBe('mid/index.m3u8')
    })

    it('parses variant streams with optional attributes', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-STREAM-INF:BANDWIDTH=1280000,CODECS="avc1.42e00a,mp4a.40.2",RESOLUTION=640x360,FRAME-RATE=29.97,AUDIO="audio-group",VIDEO="video-group",SUBTITLES="subs"',
            'variant.m3u8',
        ].join('\n')

        const result = parseMainPlaylist(manifest)
        const v = result.variants[0]
        expect(v.bandwidth).toBe(1280000)
        expect(v.codecs).toBe('avc1.42e00a,mp4a.40.2')
        expect(v.width).toBe(640)
        expect(v.height).toBe(360)
        expect(v.frameRate).toBe(29.97)
        expect(v.audioGroup).toBe('audio-group')
        expect(v.videoGroup).toBe('video-group')
        expect(v.subtitlesGroup).toBe('subs')
    })

    it('parses alternative renditions', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="English",LANGUAGE="en",DEFAULT=YES,AUTOSELECT=YES,URI="audio/en.m3u8"',
            '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Spanish",LANGUAGE="es",DEFAULT=NO,AUTOSELECT=NO',
        ].join('\n')

        const result = parseMainPlaylist(manifest)
        expect(result.alternativeRenditions.length).toBe(2)

        const en = result.alternativeRenditions[0]
        expect(en.type).toBe('AUDIO')
        expect(en.groupId).toBe('audio')
        expect(en.name).toBe('English')
        expect(en.language).toBe('en')
        expect(en.default).toBe(true)
        expect(en.autoSelect).toBe(true)
        expect(en.uri).toBe('audio/en.m3u8')

        const es = result.alternativeRenditions[1]
        expect(es.default).toBe(false)
        expect(es.autoSelect).toBe(false)
        expect(es.uri).toBeUndefined()
    })

    it('parses session data', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-SESSION-DATA:DATA-ID="com.example.title",VALUE="Episode 1",LANGUAGE="en"',
            '#EXT-X-SESSION-DATA:DATA-ID="com.example.poster",URI="/poster.jpg"',
        ].join('\n')

        const result = parseMainPlaylist(manifest)
        expect(result.sessionData.length).toBe(2)
        expect(result.sessionData[0].dataId).toBe('com.example.title')
        expect(result.sessionData[0].value).toBe('Episode 1')
        expect(result.sessionData[0].language).toBe('en')
        expect(result.sessionData[0].uri).toBeUndefined()
        expect(result.sessionData[1].dataId).toBe('com.example.poster')
        expect(result.sessionData[1].uri).toBe('/poster.jpg')
        expect(result.sessionData[1].value).toBeUndefined()
    })

    it('skips blank lines and comments', () => {
        const manifest = [
            '#EXTM3U',
            '',
            '# This is a comment',
            '#EXT-X-STREAM-INF:BANDWIDTH=1280000',
            '',
            'low/index.m3u8',
        ].join('\n')

        const result = parseMainPlaylist(manifest)
        expect(result.variants.length).toBe(1)
        expect(result.variants[0].uri).toBe('low/index.m3u8')
    })

    it('handles lines with only whitespace', () => {
        const manifest = [
            '#EXTM3U',
            '   ',
            '\t\t',
            '#EXT-X-STREAM-INF:BANDWIDTH=1280000',
            '  \t  ',
            'low/index.m3u8',
        ].join('\n')

        const result = parseMainPlaylist(manifest)
        expect(result.variants.length).toBe(1)
        expect(result.variants[0].uri).toBe('low/index.m3u8')
    })

    it('handles empty manifest after header', () => {
        const manifest = '#EXTM3U\n'
        const result = parseMainPlaylist(manifest)
        expect(result.variants.length).toBe(0)
        expect(result.alternativeRenditions.length).toBe(0)
        expect(result.sessionData.length).toBe(0)
    })

    it('handles line with only whitespace in main playlist', () => {
        const manifest = `#EXTM3U
   
#EXT-X-STREAM-INF:BANDWIDTH=1280000
low/index.m3u8`
        const result = parseMainPlaylist(manifest)
        expect(result.variants.length).toBe(1)
    })

    it('handles line that becomes empty after trimming', () => {
        // Create a line with non-breaking space that might not be caught by skipWhitespaceLine
        const manifest =
            '#EXTM3U\n\u00A0\n#EXT-X-STREAM-INF:BANDWIDTH=1280000\nlow/index.m3u8'
        const result = parseMainPlaylist(manifest)
        expect(result.variants.length).toBe(1)
    })

    it('skips unrecognized tags', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-INDEPENDENT-SEGMENTS',
            '#EXT-X-STREAM-INF:BANDWIDTH=1280000',
            'low/index.m3u8',
        ].join('\n')

        const result = parseMainPlaylist(manifest)
        expect(result.variants.length).toBe(1)
    })

    it('tolerates leading whitespace before #EXTM3U', () => {
        const manifest =
            '  \n#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1280000\nlow/index.m3u8'
        const result = parseMainPlaylist(manifest)
        expect(result.variants.length).toBe(1)
    })

    it('returns empty arrays when no variants, renditions, or session data', () => {
        const result = parseMainPlaylist('#EXTM3U\n')
        expect(result.variants.length).toBe(0)
        expect(result.alternativeRenditions.length).toBe(0)
        expect(result.sessionData.length).toBe(0)
    })

    it('handles invalid resolution format', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-STREAM-INF:BANDWIDTH=1280000,RESOLUTION=640',
            'variant.m3u8',
        ].join('\n')

        expect(() => parseMainPlaylist(manifest)).toThrowError(ValidationError)
    })

    it('handles invalid resolution values', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-STREAM-INF:BANDWIDTH=1280000,RESOLUTION=0x360',
            'variant.m3u8',
        ].join('\n')

        expect(() => parseMainPlaylist(manifest)).toThrowError(ValidationError)
    })

    it('parses valid resolution correctly', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-STREAM-INF:BANDWIDTH=1280000,RESOLUTION=1920x1080',
            'variant.m3u8',
        ].join('\n')

        const result = parseMainPlaylist(manifest)
        expect(result.variants[0].width).toBe(1920)
        expect(result.variants[0].height).toBe(1080)
    })

    it('parses #EXT-X-DEFINE variables', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-DEFINE:NAME="baseUrl",VALUE="https://cdn.example.com/"',
            '#EXT-X-STREAM-INF:BANDWIDTH=500000',
            'low.m3u8',
        ].join('\n')
        const result = parseMainPlaylist(manifest)
        expect(result.defines).toEqual({ baseUrl: 'https://cdn.example.com/' })
    })

    it('ignores #EXT-X-DEFINE without VALUE', () => {
        const manifest = [
            '#EXTM3U',
            '#EXT-X-DEFINE:NAME="incomplete"',
            '#EXT-X-STREAM-INF:BANDWIDTH=500000',
            'low.m3u8',
        ].join('\n')
        const result = parseMainPlaylist(manifest)
        expect(result.defines).toEqual({})
    })
})
