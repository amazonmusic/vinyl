/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    codecToContentType,
    codecsToContentTypes,
    contentTypeToMimeType,
} from '@amazon/vinyl'

describe('codec', () => {
    describe('codecToContentType', () => {
        it('returns video for avc1', () => {
            expect(codecToContentType('avc1.640015')).toBe('video')
        })

        it('returns video for avc3', () => {
            expect(codecToContentType('avc3.640015')).toBe('video')
        })

        it('returns video for hvc1', () => {
            expect(codecToContentType('hvc1.1.6.L93.B0')).toBe('video')
        })

        it('returns video for hev1', () => {
            expect(codecToContentType('hev1.1.6.L93.B0')).toBe('video')
        })

        it('returns video for vp09', () => {
            expect(codecToContentType('vp09.00.10.08')).toBe('video')
        })

        it('returns video for av01', () => {
            expect(codecToContentType('av01.0.01M.08')).toBe('video')
        })

        it('returns video for dvh1', () => {
            expect(codecToContentType('dvh1.05.06')).toBe('video')
        })

        it('returns video for dvhe', () => {
            expect(codecToContentType('dvhe.05.06')).toBe('video')
        })

        it('returns audio for mp4a', () => {
            expect(codecToContentType('mp4a.40.2')).toBe('audio')
        })

        it('returns audio for ac-3', () => {
            expect(codecToContentType('ac-3')).toBe('audio')
        })

        it('returns audio for ec-3', () => {
            expect(codecToContentType('ec-3')).toBe('audio')
        })

        it('returns audio for opus', () => {
            expect(codecToContentType('opus')).toBe('audio')
        })

        it('returns audio for fLaC', () => {
            expect(codecToContentType('fLaC')).toBe('audio')
        })

        it('returns text for stpp', () => {
            expect(codecToContentType('stpp')).toBe('text')
        })

        it('returns text for wvtt', () => {
            expect(codecToContentType('wvtt')).toBe('text')
        })

        it('returns null for unknown codec', () => {
            expect(codecToContentType('unknown.codec')).toBeNull()
        })

        it('trims whitespace', () => {
            expect(codecToContentType('  mp4a.40.2  ')).toBe('audio')
        })

        it('is case insensitive', () => {
            expect(codecToContentType('MP4A.40.2')).toBe('audio')
            expect(codecToContentType('AVC1.640015')).toBe('video')
            expect(codecToContentType('FLAC')).toBe('audio')
            expect(codecToContentType('STPP')).toBe('text')
        })
    })

    describe('codecsToContentTypes', () => {
        it('returns audio and video for mixed codecs', () => {
            expect(codecsToContentTypes('avc1.640015,mp4a.40.2')).toEqual(
                new Set(['video', 'audio'])
            )
        })

        it('returns audio only for audio codec', () => {
            expect(codecsToContentTypes('mp4a.40.2')).toEqual(
                new Set(['audio'])
            )
        })

        it('returns video only for video codec', () => {
            expect(codecsToContentTypes('avc1.640015')).toEqual(
                new Set(['video'])
            )
        })

        it('returns empty set for unknown codecs', () => {
            expect(codecsToContentTypes('unknown')).toEqual(new Set())
        })

        it('deduplicates content types', () => {
            expect(codecsToContentTypes('avc1.640015,avc1.64001e')).toEqual(
                new Set(['video'])
            )
        })
    })

    describe('contentTypeToMimeType', () => {
        it('returns video/mp4 with codecs for video', () => {
            expect(contentTypeToMimeType('video', 'avc1.640015')).toBe(
                'video/mp4; codecs="avc1.640015"'
            )
        })

        it('returns audio/mp4 with codecs for audio', () => {
            expect(contentTypeToMimeType('audio', 'mp4a.40.2')).toBe(
                'audio/mp4; codecs="mp4a.40.2"'
            )
        })

        it('returns audio/mp4 with codecs for text', () => {
            expect(contentTypeToMimeType('text', 'wvtt')).toBe(
                'audio/mp4; codecs="wvtt"'
            )
        })

        it('returns video/mp4 without codecs when null', () => {
            expect(contentTypeToMimeType('video', null)).toBe('video/mp4')
        })

        it('returns audio/mp4 without codecs when null', () => {
            expect(contentTypeToMimeType('audio', null)).toBe('audio/mp4')
        })
    })
})
