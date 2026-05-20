/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createUrlHlsManifestProvider, fetchMediaPlaylist } from '@amazon/vinyl'
import { Abort, requesterWithRetryRef } from '@amazon/vinyl-util'
import { MockRequester } from '@amazon/vinyl-util/testUtil'

describe('createUrlHlsManifestProvider', () => {
    const mainM3u8 = [
        '#EXTM3U',
        '#EXT-X-STREAM-INF:BANDWIDTH=500000,CODECS="mp4a.40.2"',
        'audio.m3u8',
    ].join('\n')

    const mediaM3u8 = [
        '#EXTM3U',
        '#EXT-X-TARGETDURATION:6',
        '#EXT-X-PLAYLIST-TYPE:VOD',
        '#EXTINF:6.0,',
        'segment0.aac',
        '#EXT-X-ENDLIST',
    ].join('\n')

    let mockRequester: MockRequester

    beforeEach(() => {
        mockRequester = new MockRequester()
        requesterWithRetryRef.set(() => mockRequester)
        mockRequester.request.and.callFake((input: RequestInfo | URL) => {
            const url = input instanceof URL ? input.href : String(input)
            if (url.includes('audio.m3u8')) {
                return Promise.resolve(new Response(mediaM3u8))
            }
            return Promise.resolve(new Response(mainM3u8))
        })
    })

    it('parses the main playlist', async () => {
        const provider = createUrlHlsManifestProvider(
            'https://example.com/main.m3u8'
        )
        const data = await provider()
        expect(data.mainPlaylist.variants.length).toBe(1)
        expect(data.mainPlaylist.variants[0].bandwidth).toBe(500000)
    })

    it('sets the baseUrl from the response URL', async () => {
        mockRequester.request.and.callFake((_input: RequestInfo | URL) => {
            const resp = new Response(mainM3u8)
            Object.defineProperty(resp, 'url', {
                value: 'https://redirected.com/main.m3u8',
            })
            return Promise.resolve(resp)
        })
        const provider = createUrlHlsManifestProvider(
            'https://example.com/main.m3u8'
        )
        const data = await provider()
        expect(data.baseUrl).toBe('https://redirected.com/main.m3u8')
    })

    it('lazily fetches media playlists via getMediaPlaylist', async () => {
        const provider = createUrlHlsManifestProvider(
            'https://example.com/main.m3u8'
        )
        const data = await provider()
        // Only the main playlist fetch should have occurred
        expect(mockRequester.request).toHaveBeenCalledTimes(1)

        const playlist = await data.getMediaPlaylist('audio.m3u8')
        expect(playlist.targetDuration).toBe(6)
        expect(playlist.segments.length).toBe(1)
        expect(mockRequester.request).toHaveBeenCalledTimes(2)
    })

    it('caches media playlist results', async () => {
        const provider = createUrlHlsManifestProvider(
            'https://example.com/main.m3u8'
        )
        const data = await provider()
        const first = await data.getMediaPlaylist('audio.m3u8')
        const second = await data.getMediaPlaylist('audio.m3u8')
        expect(first).toBe(second)
        // Only 1 main + 1 media fetch
        expect(mockRequester.request).toHaveBeenCalledTimes(2)
    })

    it('resolves media playlist URIs relative to main URL', async () => {
        const provider = createUrlHlsManifestProvider(
            'https://example.com/path/main.m3u8'
        )
        const data = await provider()
        await data.getMediaPlaylist('audio.m3u8')
        const secondCall = mockRequester.request.calls.argsFor(1)
        expect(String(secondCall[0])).toBe(
            'https://example.com/path/audio.m3u8'
        )
    })

    it('passes requestInit to requests', async () => {
        const requestInit = { headers: { Authorization: 'Bearer token' } }
        const provider = createUrlHlsManifestProvider(
            'https://example.com/main.m3u8',
            requestInit
        )
        await provider()
        expect(mockRequester.request.calls.argsFor(0)[1]).toEqual(requestInit)
    })

    it('passes abort to requests', async () => {
        const provider = createUrlHlsManifestProvider(
            'https://example.com/main.m3u8'
        )
        const abort = new Abort()
        await provider(abort)
        expect(mockRequester.request.calls.argsFor(0)[2]).toEqual(
            jasmine.objectContaining({ abort })
        )
    })
})

describe('fetchMediaPlaylist', () => {
    const mediaM3u8 = [
        '#EXTM3U',
        '#EXT-X-TARGETDURATION:6',
        '#EXT-X-PLAYLIST-TYPE:VOD',
        '#EXTINF:6.0,',
        'segment0.aac',
        '#EXT-X-ENDLIST',
    ].join('\n')

    let mockRequester: MockRequester

    beforeEach(() => {
        mockRequester = new MockRequester()
        requesterWithRetryRef.set(() => mockRequester)
        mockRequester.request.and.callFake(() =>
            Promise.resolve(new Response(mediaM3u8))
        )
    })

    it('fetches and parses a media playlist', async () => {
        const playlist = await fetchMediaPlaylist({
            uri: 'audio.m3u8',
            baseUrl: 'https://example.com/path/main.m3u8',
            defines: undefined,
        })
        expect(playlist.targetDuration).toBe(6)
        expect(playlist.segments.length).toBe(1)
        expect(String(mockRequester.request.calls.argsFor(0)[0])).toBe(
            'https://example.com/path/audio.m3u8'
        )
    })
})
