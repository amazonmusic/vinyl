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
        preferredAudioLanguage: string | null = null
    ): DefaultMediaTimelineTransformerDeps {
        return {
            capabilities,
            drmController,
            mediaTimeline: data(Promise.resolve(timeline)),
            options: data({ preferredAudioLanguage }),
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
        }
        const result = await createDefaultMediaTimelineTransformer(
            createDeps(timeline)
        ).value
        expect(result.periods[0].qualities.length).toBe(1)
        expect(result.periods[0].qualities[0].metadata.qualityId).toBe('q1')
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
        }
        const result = await createDefaultMediaTimelineTransformer(
            createDeps(timeline)
        ).value
        expect(result.periods[0].qualities.length).toBe(1)
        expect(result.periods[0].qualities[0].metadata.qualityId).toBe('aac')
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
        }
        const options = data({
            preferredAudioLanguage: 'en' as string | null,
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

        options.value = { preferredAudioLanguage: 'ja' }
        result = await transformed.value
        expect(result.periods[0].qualities[0].metadata.qualityId).toBe('ja')
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
        }
        const result = await createDefaultMediaTimelineTransformer(
            createDeps(timeline)
        ).value
        expect(result.minBufferTime).toBe(5)
    })
})
