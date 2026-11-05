/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    CODEC_PROBE_BYTES,
    type HlsManifestData,
    type HlsMediaPlaylistData,
    withProbedHlsCodecs,
} from '@amazon/vinyl'
import type { HlsSegment, VariantStream } from '@amazon/vinyl-hls-parser'
import { Abort, noop, requesterWithRetryRef } from '@amazon/vinyl-util'
import { MockRequester, useMockLogger } from '@amazon/vinyl-util/testUtil'

/** An ADTS segment of AAC-LC 44.1 kHz stereo frames. */
function adtsSegment(frames = 2): ArrayBuffer {
    const frameLength = 7 + 100
    const out = new Uint8Array(frameLength * frames)
    for (let f = 0; f < frames; f++) {
        const o = f * frameLength
        out[o] = 0xff
        out[o + 1] = 0xf1
        out[o + 2] = (1 << 6) | (4 << 2)
        out[o + 3] = (2 << 6) | ((frameLength >> 11) & 0x03)
        out[o + 4] = (frameLength >> 3) & 0xff
        out[o + 5] = ((frameLength & 0x07) << 5) | 0x1f
        out[o + 6] = 0xfc
    }
    return out.buffer
}

describe('withProbedHlsCodecs', () => {
    const deps = { requestInterceptor: noop, segmentRequestInit: undefined }
    let mockRequester: MockRequester
    let segments: HlsSegment[]
    let playlistBaseUrl: string | undefined

    useMockLogger()

    beforeEach(() => {
        mockRequester = new MockRequester()
        requesterWithRetryRef.set(() => mockRequester)
        mockRequester.request.and.callFake(() =>
            Promise.resolve(new Response(adtsSegment()))
        )
        playlistBaseUrl = 'https://example.com/v/playlist.m3u8'
        segments = [
            {
                uri: 'seg0.ts',
                duration: 6,
                sequenceNumber: 0,
                discontinuity: false,
            },
        ]
    })

    function manifest(variants: VariantStream[]): HlsManifestData {
        return {
            mainPlaylist: {
                variants,
                alternativeRenditions: [],
                sessionData: [],
            },
            baseUrl: 'https://example.com/main.m3u8',
            getMediaPlaylist: () =>
                Promise.resolve({
                    segments,
                    baseUrl: playlistBaseUrl,
                } as unknown as HlsMediaPlaylistData),
        }
    }

    function probe(variants: VariantStream[], abort?: Abort) {
        return withProbedHlsCodecs(deps, () =>
            Promise.resolve(manifest(variants))
        )(abort)
    }

    it('reads the codecs of a variant without CODECS from its first segment', async () => {
        const data = await probe([{ bandwidth: 1, uri: 'v/playlist.m3u8' }])
        expect(data.mainPlaylist.variants[0].codecs).toBe('mp4a.40.2')
        const [input, init] = mockRequester.request.calls.mostRecent().args
        expect(String(input)).toBe('https://example.com/v/seg0.ts')
        expect(new Headers(init?.headers).get('Range')).toBe(
            `bytes=0-${CODEC_PROBE_BYTES - 1}`
        )
    })

    it('resolves segments against the main playlist without a playlist URL', async () => {
        playlistBaseUrl = undefined
        await probe([{ bandwidth: 1, uri: 'v/playlist.m3u8' }])
        const [input] = mockRequester.request.calls.mostRecent().args
        expect(String(input)).toBe('https://example.com/v/seg0.ts')
    })

    it('reads within the first segment byte range', async () => {
        segments = [
            { ...segments[0], byteRange: { offset: 1000, length: 500 } },
        ]
        await probe([{ bandwidth: 1, uri: 'v/playlist.m3u8' }])
        const [, init] = mockRequester.request.calls.mostRecent().args
        expect(new Headers(init?.headers).get('Range')).toBe('bytes=1000-1499')
    })

    it('leaves variants with CODECS unchanged without requests', async () => {
        const variants = [
            { bandwidth: 1, uri: 'v.m3u8', codecs: 'avc1.4d401f' },
        ]
        const data = await probe(variants)
        expect(data.mainPlaylist.variants).toEqual(variants)
        expect(mockRequester.request).not.toHaveBeenCalled()
    })

    it('does not probe fMP4 or encrypted segments', async () => {
        const plain = segments[0]
        segments = [{ ...plain, map: { uri: 'init.mp4' } }]
        let data = await probe([{ bandwidth: 1, uri: 'v.m3u8' }])
        expect(data.mainPlaylist.variants[0].codecs).toBeUndefined()
        segments = [{ ...plain, key: { method: 'AES-128', uri: 'key' } }]
        data = await probe([{ bandwidth: 1, uri: 'v.m3u8' }])
        expect(data.mainPlaylist.variants[0].codecs).toBeUndefined()
        expect(mockRequester.request).not.toHaveBeenCalled()
    })

    it('probes unencrypted segments with a NONE key', async () => {
        segments = [{ ...segments[0], key: { method: 'NONE' } }]
        const data = await probe([{ bandwidth: 1, uri: 'v.m3u8' }])
        expect(data.mainPlaylist.variants[0].codecs).toBe('mp4a.40.2')
    })

    it('leaves a variant with no segments unchanged', async () => {
        segments = []
        const data = await probe([{ bandwidth: 1, uri: 'v.m3u8' }])
        expect(data.mainPlaylist.variants[0].codecs).toBeUndefined()
        expect(mockRequester.request).not.toHaveBeenCalled()
    })

    it('probes only the variants without CODECS', async () => {
        const data = await probe([
            { bandwidth: 2, uri: 'v.m3u8', codecs: 'avc1.4d401f,mp4a.40.2' },
            { bandwidth: 1, uri: 'a.m3u8' },
        ])
        expect(data.mainPlaylist.variants.map((v) => v.codecs)).toEqual([
            'avc1.4d401f,mp4a.40.2',
            'mp4a.40.2',
        ])
        expect(mockRequester.request).toHaveBeenCalledTimes(1)
    })

    it('leaves the variant unchanged when its codecs cannot be read', async () => {
        mockRequester.request.and.callFake(() =>
            Promise.resolve(new Response(new Uint8Array([1, 2, 3])))
        )
        const data = await probe([{ bandwidth: 1, uri: 'v.m3u8' }])
        expect(data.mainPlaylist.variants[0].codecs).toBeUndefined()
    })

    it('rejects when aborted', async () => {
        const abort = new Abort()
        mockRequester.request.and.callFake(() => {
            abort.abort()
            return Promise.reject(new Error('aborted'))
        })
        await expectAsync(
            probe([{ bandwidth: 1, uri: 'v.m3u8' }], abort)
        ).toBeRejected()
    })
})
