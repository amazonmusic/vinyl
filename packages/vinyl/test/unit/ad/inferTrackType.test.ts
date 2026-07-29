/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { inferTrackType } from '@amazon/vinyl'

describe('inferTrackType', () => {
    it('returns hls for .m3u8 extension', () => {
        expect(inferTrackType('https://example.com/stream.m3u8')).toBe('hls')
    })

    it('returns hls for .m3u8 with query params', () => {
        expect(
            inferTrackType('https://example.com/stream.m3u8?token=abc')
        ).toBe('hls')
    })

    it('returns dash for .mpd extension', () => {
        expect(inferTrackType('https://example.com/manifest.mpd')).toBe('dash')
    })

    it('returns dash for .mpd with query params', () => {
        expect(inferTrackType('https://example.com/manifest.mpd?v=1')).toBe(
            'dash'
        )
    })

    it('returns src for common media extensions', () => {
        expect(inferTrackType('https://example.com/audio.mp3')).toBe('src')
        expect(inferTrackType('https://example.com/video.mp4')).toBe('src')
        expect(inferTrackType('https://example.com/audio.aac')).toBe('src')
        expect(inferTrackType('https://example.com/video.webm')).toBe('src')
        expect(inferTrackType('https://example.com/audio.ogg')).toBe('src')
        expect(inferTrackType('https://example.com/audio.wav')).toBe('src')
        expect(inferTrackType('https://example.com/audio.m4a')).toBe('src')
        expect(inferTrackType('https://example.com/video.m4v')).toBe('src')
        expect(inferTrackType('https://example.com/audio.opus')).toBe('src')
    })

    it('returns src for media extensions with query params', () => {
        expect(
            inferTrackType('https://example.com/video.mp4?quality=high')
        ).toBe('src')
    })

    it('returns null for unrecognized URIs', () => {
        expect(inferTrackType('https://example.com/api/stream')).toBeNull()
        expect(inferTrackType('https://example.com/data.json')).toBeNull()
    })
})
