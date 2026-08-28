/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    buildHlsMediaTimeline,
    createDefaultMediaTimelineTransformer,
    createEmptyMediaQualityMetadata,
    type HlsManifestData,
} from '@amazon/vinyl'
import { noop } from '@amazon/vinyl-util'
import { data } from '@amazon/vinyl-observable'
import {
    MockCapabilities,
    MockDrmController,
} from '@amazon/vinyl/vinylTestUtil'
import type {
    HlsMainPlaylist,
    HlsMediaPlaylist,
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
    ): HlsMediaPlaylist {
        return {
            targetDuration: durations.length ? Math.max(...durations) : 0,
            ended,
            segments: durations.map((d, i) => ({
                duration: d,
                uri: `seg${i}.m4s`,
                map: { uri: 'init.mp4' },
            })),
        } as unknown as HlsMediaPlaylist
    }

    function createManifestData(
        variants: VariantStream[],
        playlist: HlsMediaPlaylist
    ): HlsManifestData {
        return {
            mainPlaylist: {
                variants,
                alternativeRenditions: [],
            } as unknown as HlsMainPlaylist,
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

    it('creates one audio quality per rendition for an audio-only multi-language stream', async () => {
        // Shaka's audio-only shape: each language is both an audio-only variant
        // (referencing the group) and a rendition pointing at the same playlist.
        // Demuxed audio is modeled per rendition, one quality per language.
        const playlist = createMediaPlaylist([5, 5])
        const requestedUris: string[] = []
        const manifestData: HlsManifestData = {
            mainPlaylist: {
                variants: [
                    {
                        bandwidth: 128000,
                        uri: 'audio_en.m3u8',
                        codecs: 'mp4a.40.2',
                        audioGroup: 'audio',
                    },
                    {
                        bandwidth: 129000,
                        uri: 'audio_fr.m3u8',
                        codecs: 'mp4a.40.2',
                        audioGroup: 'audio',
                    },
                ],
                alternativeRenditions: [
                    {
                        type: 'AUDIO',
                        groupId: 'audio',
                        uri: 'audio_en.m3u8',
                        language: 'en',
                        name: 'en',
                    },
                    {
                        type: 'AUDIO',
                        groupId: 'audio',
                        uri: 'audio_fr.m3u8',
                        language: 'fr',
                        name: 'fr',
                    },
                ],
            } as unknown as HlsMainPlaylist,
            baseUrl: 'https://example.com/',
            getMediaPlaylist: (uri: string) => {
                requestedUris.push(uri)
                return Promise.resolve(playlist)
            },
        }
        const timeline = buildHlsMediaTimeline(deps, manifestData)
        const audio = timeline.periods[0].qualities.filter(
            (q) => q.metadata.contentType === 'audio'
        )
        expect(
            audio
                .map((q) => q.metadata.lang)
                .sort((a, b) => String(a).localeCompare(String(b)))
        ).toEqual(['en', 'fr'])
        // Fetching an audio quality uses its own rendition playlist.
        await audio.find((q) => q.metadata.lang === 'fr')!.getSegment(2)
        expect(requestedUris).toContain('audio_fr.m3u8')
    })

    it('skips audio renditions with no URI, a duplicate URI, or an unreferenced group', () => {
        const playlist = createMediaPlaylist([5, 5])
        const manifestData: HlsManifestData = {
            mainPlaylist: {
                variants: [
                    {
                        bandwidth: 5_000_000,
                        uri: 'video.m3u8',
                        codecs: 'avc1.640015,mp4a.40.2',
                        audioGroup: 'audio',
                    },
                ],
                alternativeRenditions: [
                    // No URI: nothing to fetch, skipped.
                    {
                        type: 'AUDIO',
                        groupId: 'audio',
                        language: 'en',
                        name: 'en',
                    },
                    // First real rendition for this URI is kept.
                    {
                        type: 'AUDIO',
                        groupId: 'audio',
                        uri: 'audio.m3u8',
                        language: 'en',
                        name: 'en',
                    },
                    // Duplicate URI: deduped away.
                    {
                        type: 'AUDIO',
                        groupId: 'audio',
                        uri: 'audio.m3u8',
                        language: 'en-dup',
                        name: 'en-dup',
                    },
                    // Group referenced by no variant: no codec to play with.
                    {
                        type: 'AUDIO',
                        groupId: 'orphan',
                        uri: 'orphan.m3u8',
                        language: 'de',
                        name: 'de',
                    },
                ],
            } as unknown as HlsMainPlaylist,
            baseUrl: 'https://example.com/',
            getMediaPlaylist: () => Promise.resolve(playlist),
        }
        const timeline = buildHlsMediaTimeline(deps, manifestData)
        const audio = timeline.periods[0].qualities.filter(
            (q) => q.metadata.contentType === 'audio'
        )
        expect(audio.map((q) => q.metadata.lang)).toEqual(['en'])
    })

    it('gives same-language audio renditions distinct ids and carries characteristics', () => {
        const playlist = createMediaPlaylist([5, 5])
        const manifestData: HlsManifestData = {
            mainPlaylist: {
                variants: [
                    {
                        bandwidth: 5_000_000,
                        uri: 'video.m3u8',
                        codecs: 'avc1.640015,mp4a.40.2',
                        audioGroup: 'audio',
                    },
                ],
                alternativeRenditions: [
                    {
                        type: 'AUDIO',
                        groupId: 'audio',
                        uri: 'main.m3u8',
                        language: 'en-US',
                        name: 'English',
                    },
                    {
                        type: 'AUDIO',
                        groupId: 'audio',
                        uri: 'dvs.m3u8',
                        language: 'en-US',
                        name: 'English (DVS)',
                        characteristics: [
                            'public.accessibility.describes-video',
                        ],
                    },
                ],
            } as unknown as HlsMainPlaylist,
            baseUrl: 'https://example.com/',
            getMediaPlaylist: () => Promise.resolve(playlist),
        }
        const timeline = buildHlsMediaTimeline(deps, manifestData)
        const audio = timeline.periods[0].qualities.filter(
            (q) => q.metadata.contentType === 'audio'
        )
        expect(audio.length).toBe(2)
        // Same group + language would otherwise collide; names disambiguate.
        expect(new Set(audio.map((q) => q.metadata.qualityId)).size).toBe(2)
        const dvs = audio.find((q) =>
            q.metadata.characteristics.includes(
                'public.accessibility.describes-video'
            )
        )
        const main = audio.find((q) => q.metadata.characteristics.length === 0)
        expect(dvs).toBeDefined()
        expect(main).toBeDefined()
    })

    it('handles an audio rendition with no language and a variant with no audio codec', () => {
        const playlist = createMediaPlaylist([5, 5])
        const manifestData: HlsManifestData = {
            mainPlaylist: {
                variants: [
                    {
                        bandwidth: 5_000_000,
                        uri: 'video.m3u8',
                        // Video-only codecs: the demuxed audio has no codec.
                        codecs: 'avc1.640015',
                        audioGroup: 'audio',
                    },
                ],
                alternativeRenditions: [
                    {
                        type: 'AUDIO',
                        groupId: 'audio',
                        uri: 'audio.m3u8',
                        // No language: the quality id falls back to the name and
                        // lang is null.
                        name: 'commentary',
                    },
                ],
            } as unknown as HlsMainPlaylist,
            baseUrl: 'https://example.com/',
            getMediaPlaylist: () => Promise.resolve(playlist),
        }
        const timeline = buildHlsMediaTimeline(deps, manifestData)
        const audio = timeline.periods[0].qualities.find(
            (q) => q.metadata.contentType === 'audio'
        )!
        expect(audio.metadata.lang).toBeNull()
        expect(audio.metadata.codecs).toBeNull()
        expect(audio.metadata.qualityId).toBe('audio-audio-commentary')
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
            } as unknown as HlsMainPlaylist,
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

    // Shaka's mixed-codec shape: a single audio group whose renditions are
    // different codecs (aac/opus/flac), each paired with an audio-only variant
    // whose CODECS describes that one rendition. The flac variant is first, so
    // resolving the codec from "the first variant of the group" would mislabel
    // every rendition as flac.
    function createMixedCodecAudioManifest(
        playlist: HlsMediaPlaylist
    ): HlsManifestData {
        return {
            mainPlaylist: {
                variants: [
                    {
                        bandwidth: 141296,
                        uri: 'flac.m3u8',
                        codecs: 'flac',
                        audioGroup: 'default-audio-group',
                    },
                    {
                        bandwidth: 96017,
                        uri: 'opus.m3u8',
                        codecs: 'opus',
                        audioGroup: 'default-audio-group',
                    },
                    {
                        bandwidth: 51205,
                        uri: 'aac.m3u8',
                        codecs: 'mp4a.40.2',
                        audioGroup: 'default-audio-group',
                    },
                ],
                alternativeRenditions: [
                    {
                        type: 'AUDIO',
                        groupId: 'default-audio-group',
                        uri: 'flac.m3u8',
                        name: 'stream_flac',
                    },
                    {
                        type: 'AUDIO',
                        groupId: 'default-audio-group',
                        uri: 'opus.m3u8',
                        name: 'stream_opus',
                    },
                    {
                        type: 'AUDIO',
                        groupId: 'default-audio-group',
                        uri: 'aac.m3u8',
                        name: 'stream_aac',
                    },
                ],
            } as unknown as HlsMainPlaylist,
            baseUrl: 'https://example.com/',
            getMediaPlaylist: () => Promise.resolve(playlist),
        }
    }

    it('assigns each rendition its own codec in a mixed-codec audio group', () => {
        const manifestData = createMixedCodecAudioManifest(
            createMediaPlaylist([5, 5])
        )
        const timeline = buildHlsMediaTimeline(deps, manifestData)
        const byUri = (uri: string) =>
            timeline.periods[0].qualities.find(
                (q) => q.metadata.decoderId === uri
            )!.metadata

        expect(byUri('aac.m3u8').codecs).toBe('mp4a.40.2')
        expect(byUri('aac.m3u8').mimeType).toBe('audio/mp4; codecs="mp4a.40.2"')
        expect(byUri('opus.m3u8').codecs).toBe('opus')
        expect(byUri('opus.m3u8').mimeType).toBe('audio/mp4; codecs="opus"')
        expect(byUri('flac.m3u8').codecs).toBe('flac')
        expect(byUri('flac.m3u8').mimeType).toBe('audio/mp4; codecs="flac"')
    })

    it('keeps the AAC rendition playable when the browser rejects opus and flac', async () => {
        const capabilities = new MockCapabilities()
        // Safari-like: only AAC is playable via MSE.
        capabilities.canPlayTypeMse.and.callFake((type: string) =>
            type.includes('mp4a')
        )
        capabilities.sampleRate = 192_000
        const drmController = new MockDrmController()
        drmController.isSupported.and.resolveTo({
            supported: true,
            persistentState: false,
        })

        const manifestData = createMixedCodecAudioManifest(
            createMediaPlaylist([5, 5])
        )
        const timeline = buildHlsMediaTimeline(deps, manifestData)

        const result = await createDefaultMediaTimelineTransformer({
            capabilities,
            drmController,
            mediaTimeline: data(Promise.resolve(timeline)),
            options: data({
                audio: { selection: { language: null, descriptive: false } },
                codecOverrides: {},
            }),
        }).value

        const audio = result.periods[0].qualities.filter(
            (q) => q.metadata.contentType === 'audio'
        )
        // Only the AAC rendition survives; the period is not emptied, so no
        // MediaUnsupportedError is thrown.
        expect(audio.map((q) => q.metadata.codecs)).toEqual(['mp4a.40.2'])
    })

    it('uses transmux path when no EXT-X-MAP is present', async () => {
        const variant = createVariant('v1.m3u8', 128000)
        const playlist = {
            targetDuration: 10,
            segments: [{ duration: 10, uri: 'seg0.ts' }],
        } as unknown as HlsMediaPlaylist
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
            } as unknown as HlsMainPlaylist,
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
            } as unknown as HlsMainPlaylist,
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
        } as unknown as HlsMediaPlaylist
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
