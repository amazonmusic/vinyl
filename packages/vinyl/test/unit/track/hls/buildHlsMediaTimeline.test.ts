/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    buildHlsMediaTimeline,
    createEmptyMediaQualityMetadata,
    type HlsManifestData,
} from '@amazon/vinyl'
import { noop } from '@amazon/vinyl-util'
import type {
    MainPlaylist,
    MediaPlaylist,
    VariantStream,
} from '@amazon/vinyl-hls-parser'

describe('buildHlsMediaTimeline', () => {
    function createVariant(uri: string, bandwidth: number): VariantStream {
        return {
            bandwidth,
            uri,
            codecs: 'mp4a.40.2',
        }
    }

    function createMediaPlaylist(
        durations: number[],
        ended = true
    ): MediaPlaylist {
        return {
            targetDuration: durations.length ? Math.max(...durations) : 0,
            ended,
            segments: durations.map((d, i) => ({
                duration: d,
                uri: `seg${i}.m4s`,
                map: { uri: 'init.mp4' },
            })),
        } as unknown as MediaPlaylist
    }

    function createManifestData(
        variants: VariantStream[],
        playlist: MediaPlaylist
    ): HlsManifestData {
        return {
            mainPlaylist: {
                variants,
                alternativeRenditions: [],
            } as unknown as MainPlaylist,
            baseUrl: 'https://example.com/',
            getMediaPlaylist: () => Promise.resolve(playlist),
        }
    }

    const deps = {
        mediaQualityMetadataResolver: () => ({
            ...createEmptyMediaQualityMetadata(),
            contentType: 'audio' as const,
        }),
        requestInterceptor: noop,
        segmentRequestInit: undefined,
    }

    it('builds a single-period timeline from HLS manifest', () => {
        const variant = createVariant('v1.m3u8', 128000)
        const playlist = createMediaPlaylist([4, 4, 4])
        const data = createManifestData([variant], playlist)

        const timeline = buildHlsMediaTimeline(deps, data)

        expect(timeline.periods.length).toBe(1)
        expect(timeline.periods[0].startTime).toBe(0)
        expect(timeline.periods[0].endTime).toBe(Infinity)
        expect(timeline.minBufferTime).toBe(10)
    })

    it('computes duration lazily from media playlist', async () => {
        const variant = createVariant('v1.m3u8', 128000)
        const playlist = createMediaPlaylist([4, 4, 4])
        const data = createManifestData([variant], playlist)

        const timeline = buildHlsMediaTimeline(deps, data)
        expect(await timeline.getDuration()).toBe(12)
    })

    it('returns Infinity for live playlists (no EXT-X-ENDLIST)', async () => {
        const variant = createVariant('v1.m3u8', 128000)
        const playlist = createMediaPlaylist([4, 4], false)
        const data = createManifestData([variant], playlist)

        const timeline = buildHlsMediaTimeline(deps, data)
        expect(await timeline.getDuration()).toBe(Infinity)
    })

    it('creates one quality per variant', () => {
        const v1 = createVariant('v1.m3u8', 128000)
        const v2 = createVariant('v2.m3u8', 256000)
        const playlist = createMediaPlaylist([4, 4])
        const data = createManifestData([v1, v2], playlist)

        const timeline = buildHlsMediaTimeline(deps, data)

        expect(timeline.periods[0].qualities.length).toBe(2)
    })

    it('quality getSegment returns a segment reference', async () => {
        const variant = createVariant('v1.m3u8', 128000)
        const playlist = createMediaPlaylist([10, 10])
        const data = createManifestData([variant], playlist)

        const timeline = buildHlsMediaTimeline(deps, data)
        const quality = timeline.periods[0].qualities[0]
        const segment = await quality.getSegment(5)

        expect(segment).not.toBeNull()
        expect(segment!.startTime).toBe(0)
        expect(segment!.endTime).toBe(10)
    })

    it('quality getSegment returns null for out-of-range time', async () => {
        const variant = createVariant('v1.m3u8', 128000)
        const playlist = createMediaPlaylist([10])
        const data = createManifestData([variant], playlist)

        const timeline = buildHlsMediaTimeline(deps, data)
        const quality = timeline.periods[0].qualities[0]
        const segment = await quality.getSegment(100)

        expect(segment).toBeNull()
    })

    it('handles empty variants', () => {
        const data = createManifestData([], createMediaPlaylist([]))
        const timeline = buildHlsMediaTimeline(deps, data)
        expect(timeline.periods[0].qualities.length).toBe(0)
        expect(timeline.periods[0].endTime).toBe(Infinity)
    })

    it('uses variant URI for audio when variant is audio-only with audioGroup', async () => {
        const variant = {
            ...createVariant('flac.m3u8', 2_000_000),
            codecs: 'flac',
            audioGroup: 'audio-group',
        } as VariantStream
        const playlist = createMediaPlaylist([5, 5])
        const requestedUris: string[] = []
        const manifestData: HlsManifestData = {
            mainPlaylist: {
                variants: [variant],
                alternativeRenditions: [
                    {
                        type: 'AUDIO',
                        groupId: 'audio-group',
                        uri: 'aac.m3u8',
                        language: 'en',
                    },
                ],
            } as unknown as MainPlaylist,
            baseUrl: 'https://example.com/',
            getMediaPlaylist: (uri: string) => {
                requestedUris.push(uri)
                return Promise.resolve(playlist)
            },
        }
        const timeline = buildHlsMediaTimeline(deps, manifestData)
        const segment = await timeline.periods[0].qualities[0].getSegment(2)
        expect(segment).not.toBeNull()
        expect(requestedUris).toContain('flac.m3u8')
        expect(requestedUris).not.toContain('aac.m3u8')
    })

    it('uses rendition URI for audio when variant carries both video and audio', async () => {
        const variant = {
            bandwidth: 5_000_000,
            uri: 'video.m3u8',
            codecs: 'avc1.640015,mp4a.40.2',
            audioGroup: 'audio-group',
        } as VariantStream
        const playlist = createMediaPlaylist([5, 5])
        const requestedUris: string[] = []
        const manifestData: HlsManifestData = {
            mainPlaylist: {
                variants: [variant],
                alternativeRenditions: [
                    {
                        type: 'AUDIO',
                        groupId: 'audio-group',
                        uri: 'audio.m3u8',
                        language: 'en',
                    },
                ],
            } as unknown as MainPlaylist,
            baseUrl: 'https://example.com/',
            getMediaPlaylist: (uri: string) => {
                requestedUris.push(uri)
                return Promise.resolve(playlist)
            },
        }
        const timeline = buildHlsMediaTimeline(deps, manifestData)
        const audioQuality = timeline.periods[0].qualities.find(
            (q) => q.metadata.contentType === 'audio'
        )!
        const videoQuality = timeline.periods[0].qualities.find(
            (q) => q.metadata.contentType === 'video'
        )!

        await videoQuality.getSegment(2)
        expect(requestedUris).toEqual(['video.m3u8'])

        requestedUris.length = 0
        await audioQuality.getSegment(2)
        expect(requestedUris).toEqual(['audio.m3u8'])
    })

    it('uses transmux path when no EXT-X-MAP is present', async () => {
        const variant = createVariant('v1.m3u8', 128000)
        const playlist = {
            targetDuration: 10,
            segments: [{ duration: 10, uri: 'seg0.ts' }],
        } as unknown as MediaPlaylist
        const manifestData = createManifestData([variant], playlist)

        // Build a minimal ADTS frame for the transmuxer
        function adtsFrame(payloadSize: number): Uint8Array<ArrayBuffer> {
            const frameLength = 7 + payloadSize
            const frame = new Uint8Array(frameLength)
            frame[0] = 0xff
            frame[1] = 0xf1
            frame[2] = (1 << 6) | (4 << 2) | 0
            frame[3] = (2 << 6) | ((frameLength >> 11) & 0x03)
            frame[4] = (frameLength >> 3) & 0xff
            frame[5] = ((frameLength & 0x07) << 5) | 0x1f
            frame[6] = 0xfc
            for (let i = 7; i < frameLength; i++) frame[i] = 0xab
            return frame
        }
        const adtsData = adtsFrame(100)
        const fetchSpy = spyOn(globalThis, 'fetch').and.callFake(() =>
            Promise.resolve(new Response(adtsData.buffer.slice(0)))
        )

        const timeline = buildHlsMediaTimeline(deps, manifestData)
        const quality = timeline.periods[0].qualities[0]
        const segment = await quality.getSegment(5)
        expect(segment).not.toBeNull()
        // Call data and initData to cover the transmux function bodies
        const data = await segment!.data()
        expect(data).toEqual(jasmine.any(ArrayBuffer))
        const initData = await segment!.initData()
        expect(initData).toEqual(jasmine.any(ArrayBuffer))
        fetchSpy.and.callThrough()
    })

    it('handles variant without codecs in narrowing', async () => {
        const variant = {
            bandwidth: 128000,
            uri: 'v1.m3u8',
            // no codecs property
        } as VariantStream
        const playlist = createMediaPlaylist([10])
        const manifestData = createManifestData([variant], playlist)

        const timeline = buildHlsMediaTimeline(deps, manifestData)
        const quality = timeline.periods[0].qualities[0]
        const segment = await quality.getSegment(5)
        expect(segment).not.toBeNull()
        // codecs should fall back to metadata.codecs
        expect(segment!.quality.codecs).toBeNull()
    })

    it('getDuration rejects when getMediaPlaylist fails', async () => {
        const variant = createVariant('v1.m3u8', 128000)
        const manifestData: HlsManifestData = {
            mainPlaylist: {
                variants: [variant],
                alternativeRenditions: [],
            } as unknown as MainPlaylist,
            baseUrl: 'https://example.com/',
            getMediaPlaylist: () => Promise.reject(new Error('disposed')),
        }
        const timeline = buildHlsMediaTimeline(deps, manifestData)
        await expectAsync(timeline.getDuration()).toBeRejected()
    })

    it('getDuration caches the result', async () => {
        const variant = createVariant('v1.m3u8', 128000)
        const playlist = createMediaPlaylist([5, 5])
        let calls = 0
        const manifestData: HlsManifestData = {
            mainPlaylist: {
                variants: [variant],
                alternativeRenditions: [],
            } as unknown as MainPlaylist,
            baseUrl: 'https://example.com/',
            getMediaPlaylist: () => {
                calls++
                return Promise.resolve(playlist)
            },
        }
        const timeline = buildHlsMediaTimeline(deps, manifestData)
        expect(await timeline.getDuration()).toBe(10)
        expect(await timeline.getDuration()).toBe(10)
        expect(calls).toBe(1)
    })

    it('getDuration throws for empty segments in a complete playlist', async () => {
        const variant = createVariant('v1.m3u8', 128000)
        const playlist = createMediaPlaylist([])
        const manifestData = createManifestData([variant], playlist)
        const timeline = buildHlsMediaTimeline(deps, manifestData)
        await expectAsync(timeline.getDuration()).toBeRejectedWithError(
            /no segments/i
        )
    })

    it('passes byteRange from map to createSegmentDataProvider as mediaRange', async () => {
        const variant = createVariant('v1.m3u8', 128000)
        const playlist = {
            targetDuration: 10,
            segments: [
                {
                    duration: 10,
                    uri: 'seg0.m4s',
                    map: {
                        uri: 'init.mp4',
                        byteRange: { offset: 0, length: 500 },
                    },
                },
            ],
        } as unknown as MediaPlaylist
        const manifestData = createManifestData([variant], playlist)

        const fetchSpy = spyOn(globalThis, 'fetch').and.callFake(
            (input: RequestInfo | URL) => {
                const url =
                    typeof input === 'string'
                        ? input
                        : input instanceof URL
                          ? input.href
                          : input.url
                if (url.includes('init.mp4')) {
                    return Promise.resolve(new Response(new ArrayBuffer(500)))
                }
                return Promise.resolve(new Response(new ArrayBuffer(100)))
            }
        )

        const timeline = buildHlsMediaTimeline(deps, manifestData)
        const quality = timeline.periods[0].qualities[0]
        const segment = await quality.getSegment(5)
        expect(segment).not.toBeNull()
        await segment!.initData()
        // Verify the Range header was set for the init segment
        const initCall = fetchSpy.calls
            .allArgs()
            .find(
                (args) =>
                    typeof args[0] === 'string' && args[0].includes('init.mp4')
            )
        expect(initCall).toBeDefined()
        expect(initCall![1]?.headers).toEqual(
            jasmine.objectContaining({ Range: 'bytes=0-499' })
        )
        fetchSpy.and.callThrough()
    })

    it('getDuration throws when no variants', async () => {
        const manifestData = createManifestData([], createMediaPlaylist([]))
        const timeline = buildHlsMediaTimeline(deps, manifestData)
        await expectAsync(timeline.getDuration()).toBeRejectedWithError(
            /no variants/i
        )
    })
})
