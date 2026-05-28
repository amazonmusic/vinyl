/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseMainPlaylist, parseMediaPlaylist } from '@amazon/vinyl-hls-parser'
import {
    hls_mainPlaylist,
    hls_mediaPlaylist,
    hls_mediaPlaylistWithByteRanges,
} from '@amazon/vinyl-hls-parser/hlsTestAssets'

describe('parseHlsManifest', () => {
    it('parses HLS main playlist test asset', () => {
        const result = parseMainPlaylist(hls_mainPlaylist)

        // Verify basic structure
        expect(result.variants.length).toBe(3)
        expect(result.alternativeRenditions.length).toBe(3)

        // Verify variant streams
        expect(result.variants[0].bandwidth).toBe(1280000)
        expect(result.variants[0].uri).toBe('low/index.m3u8')
        expect(result.variants[0].codecs).toBe('avc1.42e00a,mp4a.40.2')
        expect(result.variants[0].width).toBe(640)
        expect(result.variants[0].height).toBe(360)

        // Verify alternative renditions
        const audioRenditions = result.alternativeRenditions.filter(
            (r) => r.type === 'AUDIO'
        )
        expect(audioRenditions.length).toBe(2)
        expect(audioRenditions[0].name).toBe('English')
        expect(audioRenditions[0].language).toBe('en')
        expect(audioRenditions[0].default).toBe(true)
    })

    it('parses HLS media playlist test asset', () => {
        const result = parseMediaPlaylist(hls_mediaPlaylist)

        // Verify media playlist structure
        expect(result.version).toBe(3)
        expect(result.targetDuration).toBe(10)
        expect(result.mediaSequence).toBe(0)
        expect(result.playlistType).toBe('VOD')
        expect(result.ended).toBe(true)
        expect(result.segments.length).toBe(6)

        // Verify segments
        expect(result.segments[0].uri).toBe('segment00000.ts')
        expect(result.segments[0].duration).toBe(9.009)
        expect(result.segments[0].sequenceNumber).toBe(0)
        expect(result.segments[5].duration).toBe(5.005)
    })

    it('parses HLS media playlist with byte ranges', () => {
        const result = parseMediaPlaylist(hls_mediaPlaylistWithByteRanges)

        expect(result.segments.length).toBe(3)
        expect(result.segments[0].byteRange?.length).toBe(1000000)
        expect(result.segments[0].byteRange?.offset).toBe(0)
        expect(result.segments[1].byteRange?.offset).toBe(1000000)
        expect(result.segments[2].discontinuity).toBe(true)
    })

    it('keeps URIs relative in parsed results', () => {
        const result = parseMainPlaylist(hls_mainPlaylist)

        expect(result.variants[0].uri).toBe('low/index.m3u8')
        expect(result.variants[1].uri).toBe('mid/index.m3u8')
        expect(result.variants[2].uri).toBe('high/index.m3u8')
    })
})
