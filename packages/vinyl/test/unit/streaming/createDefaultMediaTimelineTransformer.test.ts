/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createDefaultMediaTimelineTransformer,
    createEmptyMediaQualityMetadata,
    type DefaultMediaTimelineTransformerDeps,
    type MediaQualityData,
    type MediaTimeline,
} from '@amazon/vinyl'
import { data } from '@amazon/vinyl-observable'
import {
    MockCapabilities,
    MockDrmController,
} from '@amazon/vinyl/vinylTestUtil'

function createQuality(
    overrides: Partial<ReturnType<typeof createEmptyMediaQualityMetadata>>
): MediaQualityData {
    return {
        metadata: { ...createEmptyMediaQualityMetadata(), ...overrides },
        getSegment: () => Promise.resolve(null),
    }
}

describe('createDefaultMediaTimelineTransformer', () => {
    let capabilities: MockCapabilities
    let drmController: MockDrmController

    beforeEach(() => {
        capabilities = new MockCapabilities()
        capabilities.canPlayTypeMse.and.returnValue(true)
        capabilities.sampleRate = 192_000
        drmController = new MockDrmController()
        drmController.isSupported.and.resolveTo({
            supported: true,
            persistentState: false,
        })
    })

    function createDeps(
        timeline: MediaTimeline,
        preferredAudioLanguage: string | null = null,
        codecOverrides: Record<string, 'allow' | 'deny'> = {},
        preferDescriptiveAudio = false
    ): DefaultMediaTimelineTransformerDeps {
        return {
            capabilities,
            drmController,
            mediaTimeline: data(Promise.resolve(timeline)),
            options: data({
                audio: {
                    selection: {
                        language: preferredAudioLanguage,
                        descriptive: preferDescriptiveAudio,
                    },
                },
                codecOverrides,
            }),
        }
    }

    it('passes through playable qualities', async () => {
        const timeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 100,
                    qualities: [
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4',
                            qualityId: 'q1',
                        }),
                    ],
                },
            ],
            minBufferTime: 2,
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
        }
        const result = await createDefaultMediaTimelineTransformer(
            createDeps(timeline)
        ).value
        expect(result.periods[0].qualities.length).toBe(1)
        expect(result.periods[0].qualities[0].metadata.qualityId).toBe('q1')
    })

    it('selects main vs audio-description audio per preferDescriptiveAudio', async () => {
        const makeTimeline = (): MediaTimeline => ({
            periods: [
                {
                    startTime: 0,
                    endTime: 100,
                    qualities: [
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4',
                            qualityId: 'main',
                            lang: 'en',
                        }),
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4',
                            qualityId: 'dvs',
                            lang: 'en',
                            characteristics: [
                                'public.accessibility.describes-video',
                            ],
                        }),
                    ],
                },
            ],
            minBufferTime: 2,
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
        })
        const audioIds = (t: MediaTimeline) =>
            t.periods[0].qualities.map((q) => q.metadata.qualityId)

        const byDefault = await createDefaultMediaTimelineTransformer(
            createDeps(makeTimeline())
        ).value
        expect(audioIds(byDefault)).toEqual(['main'])

        const optedIn = await createDefaultMediaTimelineTransformer(
            createDeps(makeTimeline(), null, {}, true)
        ).value
        expect(audioIds(optedIn)).toEqual(['dvs'])
    })

    it('does not let a described rendition with a closer language tag evict the main audio', async () => {
        // The main audio is region-tagged ('en-US') while the described
        // rendition carries the generic 'en'. Against a preference of 'en',
        // 'en' scores an exact match and 'en-US' only a related one, so if the
        // language filter ran before the audio-description gate it would drop
        // the main audio and strand the (not-opted-in) listener on described
        // audio. The description gate must run first so the main audio wins.
        const makeTimeline = (): MediaTimeline => ({
            periods: [
                {
                    startTime: 0,
                    endTime: 100,
                    qualities: [
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4',
                            qualityId: 'main',
                            lang: 'en-US',
                        }),
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4',
                            qualityId: 'dvs',
                            lang: 'en',
                            characteristics: [
                                'public.accessibility.describes-video',
                            ],
                        }),
                    ],
                },
            ],
            minBufferTime: 2,
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
        })
        const audioIds = (t: MediaTimeline) =>
            t.periods[0].qualities.map((q) => q.metadata.qualityId)

        const byDefault = await createDefaultMediaTimelineTransformer(
            createDeps(makeTimeline(), 'en')
        ).value
        expect(audioIds(byDefault)).toEqual(['main'])

        // Opting in still yields the described rendition (the eligibility gate
        // keeps only it, then language selection picks among what remains).
        const optedIn = await createDefaultMediaTimelineTransformer(
            createDeps(makeTimeline(), 'en', {}, true)
        ).value
        expect(audioIds(optedIn)).toEqual(['dvs'])
    })

    it('filters out unsupported mime types', async () => {
        capabilities.canPlayTypeMse.and.callFake((type: string) =>
            type.includes('mp4a')
        )
        const timeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 100,
                    qualities: [
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4; codecs="mp4a.40.2"',
                            qualityId: 'aac',
                        }),
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4; codecs="flac"',
                            qualityId: 'flac',
                        }),
                    ],
                },
            ],
            minBufferTime: 2,
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
        }
        const result = await createDefaultMediaTimelineTransformer(
            createDeps(timeline)
        ).value
        expect(result.periods[0].qualities.length).toBe(1)
        expect(result.periods[0].qualities[0].metadata.qualityId).toBe('aac')
    })

    it('denies a codec via codecOverrides even when the browser supports it', async () => {
        capabilities.canPlayTypeMse.and.returnValue(true)
        const timeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 100,
                    qualities: [
                        createQuality({
                            contentType: 'video',
                            mimeType: 'video/mp4; codecs="hvc1.1"',
                            qualityId: 'hevc',
                        }),
                        createQuality({
                            contentType: 'video',
                            mimeType: 'video/mp4; codecs="avc1.64001f"',
                            qualityId: 'avc',
                        }),
                    ],
                },
            ],
            minBufferTime: 2,
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
        }
        const result = await createDefaultMediaTimelineTransformer(
            createDeps(timeline, null, { hvc1: 'deny' })
        ).value
        expect(
            result.periods[0].qualities.map((q) => q.metadata.qualityId)
        ).toEqual(['avc'])
    })

    it('allows a codec via codecOverrides even when the browser reports it unsupported', async () => {
        // Browser rejects everything; the override forces the codec through.
        capabilities.canPlayTypeMse.and.returnValue(false)
        const timeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 100,
                    qualities: [
                        createQuality({
                            contentType: 'video',
                            mimeType: 'video/mp4; codecs="hvc1.1"',
                            qualityId: 'hevc',
                        }),
                    ],
                },
            ],
            minBufferTime: 2,
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
        }
        const result = await createDefaultMediaTimelineTransformer(
            createDeps(timeline, null, { hvc1: 'allow' })
        ).value
        expect(
            result.periods[0].qualities.map((q) => q.metadata.qualityId)
        ).toEqual(['hevc'])
        // The override supersedes the browser check, which is not consulted.
        expect(capabilities.canPlayTypeMse).not.toHaveBeenCalled()
    })

    it('filters out unsupported key systems', async () => {
        drmController.isSupported.and.callFake(
            (metadata: { contentProtections: readonly any[] }) =>
                Promise.resolve(
                    metadata.contentProtections.length === 0
                        ? { supported: true, persistentState: false }
                        : { supported: false, persistentState: false }
                )
        )
        const timeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 100,
                    qualities: [
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4',
                            qualityId: 'unprotected',
                        }),
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4',
                            qualityId: 'protected',
                            contentProtections: [
                                { keySystem: 'com.widevine.alpha' as any },
                            ],
                        }),
                    ],
                },
            ],
            minBufferTime: 2,
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
        }
        const result = await createDefaultMediaTimelineTransformer(
            createDeps(timeline)
        ).value
        expect(result.periods[0].qualities.length).toBe(1)
        expect(result.periods[0].qualities[0].metadata.qualityId).toBe(
            'unprotected'
        )
    })

    it('filters by preferred language', async () => {
        const timeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 100,
                    qualities: [
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4',
                            lang: 'en',
                            qualityId: 'en',
                        }),
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4',
                            lang: 'ja',
                            qualityId: 'ja',
                        }),
                    ],
                },
            ],
            minBufferTime: 2,
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
        }
        const result = await createDefaultMediaTimelineTransformer(
            createDeps(timeline, 'en')
        ).value
        expect(result.periods[0].qualities.length).toBe(1)
        expect(result.periods[0].qualities[0].metadata.qualityId).toBe('en')
    })

    it('re-evaluates when language preference changes', async () => {
        const timeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 100,
                    qualities: [
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4',
                            lang: 'en',
                            qualityId: 'en',
                        }),
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4',
                            lang: 'ja',
                            qualityId: 'ja',
                        }),
                    ],
                },
            ],
            minBufferTime: 2,
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
        }
        const options = data({
            audio: { selection: { language: 'en' } },
        })
        const deps: DefaultMediaTimelineTransformerDeps = {
            capabilities,
            drmController,
            mediaTimeline: data(Promise.resolve(timeline)),
            options,
        }
        const transformed = createDefaultMediaTimelineTransformer(deps)
        const unsub = transformed.onData(() => {})
        let result = await transformed.value
        expect(result.periods[0].qualities[0].metadata.qualityId).toBe('en')

        options.value = { audio: { selection: { language: 'ja' } } }
        result = await transformed.value
        expect(result.periods[0].qualities[0].metadata.qualityId).toBe('ja')
        unsub()
    })

    it('disables the sampling-rate filter via audio options at runtime', async () => {
        // Output device at 44.1kHz: the 96kHz rendition is normally dropped
        // (a 44.1kHz alternative exists, so the keep-lowest fallback declines).
        capabilities.sampleRate = 44_100
        const timeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 100,
                    qualities: [
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4',
                            qualityId: 'a44',
                            audioSamplingRate: [44_100],
                        }),
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4',
                            qualityId: 'a96',
                            audioSamplingRate: [96_000],
                        }),
                    ],
                },
            ],
            minBufferTime: 2,
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
        }
        const options = data({ audio: { disableSampleRateFilter: false } })
        const transformed = createDefaultMediaTimelineTransformer({
            capabilities,
            drmController,
            mediaTimeline: data(Promise.resolve(timeline)),
            options,
        })
        const unsub = transformed.onData(() => {})
        const ids = (t: MediaTimeline) =>
            t.periods[0].qualities.map((q) => q.metadata.qualityId)

        // Filter on: the 96kHz rendition is dropped.
        expect(ids(await transformed.value)).toEqual(['a44'])

        // Filter off: both renditions are kept.
        options.value = { audio: { disableSampleRateFilter: true } }
        expect(ids(await transformed.value)).toEqual(['a44', 'a96'])
        unsub()
    })

    it('honors audio.maxSampleRate over the reported rate at runtime', async () => {
        // AudioContext reports 48kHz, so the 96kHz rendition is dropped.
        capabilities.sampleRate = 48_000
        const timeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 100,
                    qualities: [
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4',
                            qualityId: 'a48',
                            audioSamplingRate: [48_000],
                        }),
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4',
                            qualityId: 'a96',
                            audioSamplingRate: [96_000],
                        }),
                    ],
                },
            ],
            minBufferTime: 2,
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
        }
        const options = data({ audio: {} })
        const transformed = createDefaultMediaTimelineTransformer({
            capabilities,
            drmController,
            mediaTimeline: data(Promise.resolve(timeline)),
            options,
        })
        const unsub = transformed.onData(() => {})
        const ids = (t: MediaTimeline) =>
            t.periods[0].qualities.map((q) => q.metadata.qualityId)

        expect(ids(await transformed.value)).toEqual(['a48'])

        // Raise the cap to 96kHz: the 96kHz rendition is now kept.
        options.value = { audio: { maxSampleRate: 96_000 } }
        expect(ids(await transformed.value)).toEqual(['a48', 'a96'])
        unsub()
    })

    it('applies audio.minSampleRate as a soft floor at runtime', async () => {
        capabilities.sampleRate = 192_000 // max cap drops nothing
        const timeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 100,
                    qualities: [
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4',
                            qualityId: 'a48',
                            audioSamplingRate: [48_000],
                        }),
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4',
                            qualityId: 'a24',
                            audioSamplingRate: [24_000],
                        }),
                    ],
                },
            ],
            minBufferTime: 2,
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
        }
        const options = data({ audio: {} })
        const transformed = createDefaultMediaTimelineTransformer({
            capabilities,
            drmController,
            mediaTimeline: data(Promise.resolve(timeline)),
            options,
        })
        const unsub = transformed.onData(() => {})
        const ids = (t: MediaTimeline) =>
            t.periods[0].qualities.map((q) => q.metadata.qualityId)

        expect(ids(await transformed.value)).toEqual(['a48', 'a24'])

        // Floor at 48kHz: the 24kHz rendition is dropped.
        options.value = { audio: { minSampleRate: 48_000 } }
        expect(ids(await transformed.value)).toEqual(['a48'])
        unsub()
    })

    it('preserves minBufferTime', async () => {
        const timeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 100,
                    qualities: [
                        createQuality({
                            contentType: 'audio',
                            mimeType: 'audio/mp4',
                        }),
                    ],
                },
            ],
            minBufferTime: 5,
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
        }
        const result = await createDefaultMediaTimelineTransformer(
            createDeps(timeline)
        ).value
        expect(result.minBufferTime).toBe(5)
    })
})
