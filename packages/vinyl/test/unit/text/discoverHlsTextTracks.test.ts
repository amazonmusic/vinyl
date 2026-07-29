/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { discoverHlsTextTracks } from '@amazon/vinyl'
import type { MainPlaylist } from '@amazon/vinyl-hls-parser'

describe('discoverHlsTextTracks', () => {
    function makePlaylist(overrides: Partial<MainPlaylist> = {}): MainPlaylist {
        return {
            variants: [],
            alternativeRenditions: [],
            sessionData: [],
            ...overrides,
        }
    }

    it('returns empty when no renditions exist', () => {
        expect(
            discoverHlsTextTracks(makePlaylist(), 'https://x/main.m3u8')
        ).toEqual([])
    })

    it('discovers a SUBTITLES rendition with a uri', () => {
        const playlist = makePlaylist({
            alternativeRenditions: [
                {
                    type: 'SUBTITLES',
                    groupId: 'subs',
                    name: 'English',
                    language: 'en',
                    uri: 'subs/en.vtt',
                    default: true,
                },
            ],
        })
        const result = discoverHlsTextTracks(
            playlist,
            'https://example.com/path/main.m3u8'
        )
        expect(result.length).toBe(1)
        expect(result[0]).toEqual(
            jasmine.objectContaining({
                kind: 'subtitles',
                language: 'en',
                label: 'English',
                default: true,
                uri: 'https://example.com/path/subs/en.vtt',
                mimeType: 'text/vtt',
            })
        )
    })

    it('skips SUBTITLES renditions without a uri', () => {
        const playlist = makePlaylist({
            alternativeRenditions: [
                {
                    type: 'SUBTITLES',
                    groupId: 'subs',
                    name: 'English',
                },
            ],
        })
        expect(discoverHlsTextTracks(playlist, 'https://x/main.m3u8')).toEqual(
            []
        )
    })

    it('ignores non-SUBTITLES renditions', () => {
        const playlist = makePlaylist({
            alternativeRenditions: [
                {
                    type: 'AUDIO',
                    groupId: 'aud',
                    name: 'English',
                    uri: 'aud/en.m3u8',
                },
                {
                    type: 'CLOSED-CAPTIONS',
                    groupId: 'cc',
                    name: 'English',
                },
            ],
        })
        expect(discoverHlsTextTracks(playlist, 'https://x/main.m3u8')).toEqual(
            []
        )
    })

    it('defaults language to null and default to false when absent', () => {
        const playlist = makePlaylist({
            alternativeRenditions: [
                {
                    type: 'SUBTITLES',
                    groupId: 'subs',
                    name: 'Track',
                    uri: 'subs.vtt',
                },
            ],
        })
        const result = discoverHlsTextTracks(playlist, 'https://x/main.m3u8')
        expect(result[0].language).toBeNull()
        expect(result[0].default).toBeFalse()
    })

    it('emits stable, unique ids for multiple subtitle tracks', () => {
        const playlist = makePlaylist({
            alternativeRenditions: [
                {
                    type: 'SUBTITLES',
                    groupId: 'subs',
                    name: 'English',
                    uri: 'en.vtt',
                },
                {
                    type: 'SUBTITLES',
                    groupId: 'subs',
                    name: 'Spanish',
                    uri: 'es.vtt',
                },
            ],
        })
        const ids = discoverHlsTextTracks(playlist, 'https://x/main.m3u8').map(
            (t) => t.id
        )
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('attaches parent EXT-X-DEFINE variables when present', () => {
        const playlist = makePlaylist({
            alternativeRenditions: [
                {
                    type: 'SUBTITLES',
                    groupId: 'subs',
                    name: 'English',
                    uri: 'subs/en.m3u8',
                },
            ],
            defines: { prefix: 'https://cdn.example.com/' },
        })
        const result = discoverHlsTextTracks(playlist, 'https://x/main.m3u8')
        expect(result[0].variables).toEqual({
            prefix: 'https://cdn.example.com/',
        })
    })

    it('omits variables when the parent has an empty defines map', () => {
        const playlist = makePlaylist({
            alternativeRenditions: [
                {
                    type: 'SUBTITLES',
                    groupId: 'subs',
                    name: 'English',
                    uri: 'subs/en.m3u8',
                },
            ],
            defines: {},
        })
        const result = discoverHlsTextTracks(playlist, 'https://x/main.m3u8')
        expect(result[0].variables).toBeUndefined()
    })
})
