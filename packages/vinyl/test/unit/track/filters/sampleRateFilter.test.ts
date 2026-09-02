/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    withinAudioSampleRateRange,
    createEmptyMediaQualityMetadata,
    throwSamplingRatesUnsupported,
} from '@amazon/vinyl'
import { MockCapabilities } from '@amazon/vinyl/vinylTestUtil'
import { setUserAgent } from '@amazon/vinyl-util'

describe('withinAudioSampleRateRange', () => {
    let capabilities: MockCapabilities

    beforeEach(() => {
        capabilities = new MockCapabilities()
        capabilities.sampleRate = 48_000
    })

    // The filter only gates audio content types, so gated fixtures must declare
    // contentType 'audio' (the empty metadata defaults it to null).
    function audioQuality(rate: number[] | null) {
        const quality = createEmptyMediaQualityMetadata()
        quality.contentType = 'audio'
        quality.audioSamplingRate = rate
        return quality
    }

    describe('when browser is Firefox', () => {
        beforeEach(() => {
            setUserAgent('Firefox')
        })

        it('returns false when sample rate is above supported', () => {
            const metadata = audioQuality([96_000])

            expect(
                withinAudioSampleRateRange({ capabilities }, metadata, 0, [
                    metadata,
                ])
            ).toBe(false)
        })

        it('returns false when sample rate is above 48kHz even if capabilities allows it', () => {
            capabilities.sampleRate = 96_000
            const metadata = audioQuality([96_000])

            expect(
                withinAudioSampleRateRange({ capabilities }, metadata, 0, [
                    metadata,
                ])
            ).toBe(false)
        })

        it('returns false even when all rates are above 48kHz (no fallback to lowest)', () => {
            const low = audioQuality([88_200])
            const high = audioQuality([96_000])

            expect(
                withinAudioSampleRateRange({ capabilities }, low, 0, [
                    low,
                    high,
                ])
            ).toBe(false)

            expect(
                withinAudioSampleRateRange({ capabilities }, high, 1, [
                    low,
                    high,
                ])
            ).toBe(false)
        })

        it('returns true when sample rate is at or below supported', () => {
            const metadata = audioQuality([48_000])

            expect(
                withinAudioSampleRateRange({ capabilities }, metadata, 0, [
                    metadata,
                ])
            ).toBe(true)
        })

        it('returns true when sample rate is not set', () => {
            const metadata = audioQuality(null)

            expect(
                withinAudioSampleRateRange({ capabilities }, metadata, 0, [
                    metadata,
                ])
            ).toBe(true)
        })
    })

    describe('when browser is not Firefox', () => {
        beforeEach(() => {
            setUserAgent('Chrome')
        })

        it('returns true when sample rate is at or below supported', () => {
            const metadata = audioQuality([48_000])

            expect(
                withinAudioSampleRateRange({ capabilities }, metadata, 0, [
                    metadata,
                ])
            ).toBe(true)
        })

        it('keeps everything when there is no platform max to gauge support', () => {
            capabilities.sampleRate = null
            const metadata = audioQuality([96_000])

            expect(
                withinAudioSampleRateRange({ capabilities }, metadata, 0, [
                    metadata,
                ])
            ).toBe(true)
        })

        it('returns false when sample rate is above supported and others are below', () => {
            const low = audioQuality([44_100])
            const high = audioQuality([96_000])

            expect(
                withinAudioSampleRateRange({ capabilities }, high, 1, [
                    low,
                    high,
                ])
            ).toBe(false)
        })

        it('keeps lowest sample rate when all are above supported', () => {
            const low = audioQuality([88_200])
            const high = audioQuality([96_000])

            expect(
                withinAudioSampleRateRange({ capabilities }, low, 0, [
                    low,
                    high,
                ])
            ).toBe(true)

            expect(
                withinAudioSampleRateRange({ capabilities }, high, 1, [
                    low,
                    high,
                ])
            ).toBe(false)
        })

        it('an explicit maxSampleRate takes precedence — raising it keeps a higher rate', () => {
            // AudioContext reports 48kHz, which would drop the 96kHz rendition.
            capabilities.sampleRate = 48_000
            const low = audioQuality([48_000])
            const high = audioQuality([96_000])

            // Without an override, 96kHz is dropped (a 48kHz alternative exists).
            expect(
                withinAudioSampleRateRange({ capabilities }, high, 1, [
                    low,
                    high,
                ])
            ).toBe(false)

            // With maxSampleRate = 96kHz, it is kept.
            expect(
                withinAudioSampleRateRange(
                    { capabilities, maxSampleRate: 96_000 },
                    high,
                    1,
                    [low, high]
                )
            ).toBe(true)
        })

        it('an explicit maxSampleRate takes precedence — lowering it drops a rate the platform allows', () => {
            // AudioContext reports 192kHz, which would keep the 96kHz rendition.
            capabilities.sampleRate = 192_000
            const low = audioQuality([48_000])
            const high = audioQuality([96_000])

            expect(
                withinAudioSampleRateRange({ capabilities }, high, 1, [
                    low,
                    high,
                ])
            ).toBe(true)

            // Capping at 48kHz drops the 96kHz rendition and keeps the 48kHz one.
            expect(
                withinAudioSampleRateRange(
                    { capabilities, maxSampleRate: 48_000 },
                    high,
                    1,
                    [low, high]
                )
            ).toBe(false)
            expect(
                withinAudioSampleRateRange(
                    { capabilities, maxSampleRate: 48_000 },
                    low,
                    0,
                    [low, high]
                )
            ).toBe(true)
        })

        it('ignores non-audio qualities and keeps audio above the device rate', () => {
            // Output device runs at 44.1kHz while the audio is standard 48kHz.
            capabilities.sampleRate = 44_100
            const audio = audioQuality([48_000])
            // A co-present video quality is never gated and must not influence
            // the audio keep-lowest fallback.
            const video = createEmptyMediaQualityMetadata()
            video.contentType = 'video'
            video.audioSamplingRate = null

            expect(
                withinAudioSampleRateRange({ capabilities }, audio, 0, [
                    audio,
                    video,
                ])
            ).toBe(true)
            expect(
                withinAudioSampleRateRange({ capabilities }, video, 1, [
                    audio,
                    video,
                ])
            ).toBe(true)
        })
    })

    it('throws correct error', () => {
        try {
            throwSamplingRatesUnsupported()
            fail('Expected error to be thrown')
        } catch (error) {
            expect(error).toEqual(jasmine.any(Error))
            expect((error as Error).message).toBe('No supported sample rate')
        }
    })
})

describe('withinAudioSampleRateRange minSampleRate floor', () => {
    let capabilities: MockCapabilities

    beforeEach(() => {
        capabilities = new MockCapabilities()
        // High enough that the upper bound never interferes with these tests.
        capabilities.sampleRate = 192_000
    })

    function audioQuality(rate: number[] | null) {
        const quality = createEmptyMediaQualityMetadata()
        quality.contentType = 'audio'
        quality.audioSamplingRate = rate
        return quality
    }

    // minSampleRate is passed via the options arg alongside capabilities.
    function withinMin(
        metadata: ReturnType<typeof audioQuality>,
        index: number,
        array: readonly ReturnType<typeof audioQuality>[]
    ): boolean {
        return withinAudioSampleRateRange(
            { capabilities, minSampleRate: 48_000 },
            metadata,
            index,
            array
        )
    }

    it('passes through non-audio qualities', () => {
        const video = createEmptyMediaQualityMetadata()
        video.contentType = 'video'
        expect(withinMin(video, 0, [video])).toBe(true)
    })

    it('keeps qualities with no sampling rate', () => {
        const quality = audioQuality(null)
        expect(withinMin(quality, 0, [quality])).toBe(true)
    })

    it('drops rates below the floor when a rate at or above it exists', () => {
        const low = audioQuality([24_000])
        const high = audioQuality([48_000])
        expect(withinMin(high, 1, [low, high])).toBe(true)
        expect(withinMin(low, 0, [low, high])).toBe(false)
    })

    it('keeps the highest when every rate is below the floor', () => {
        const low = audioQuality([16_000])
        const mid = audioQuality([24_000])
        expect(withinMin(mid, 1, [low, mid])).toBe(true)
        expect(withinMin(low, 0, [low, mid])).toBe(false)
    })

    it('ignores non-audio qualities in the floor fallback', () => {
        const audio = audioQuality([24_000]) // below the floor
        const video = createEmptyMediaQualityMetadata()
        video.contentType = 'video'
        video.audioSamplingRate = null
        // Below the 48kHz floor but the only audio → kept; video is ignored.
        expect(withinMin(audio, 0, [audio, video])).toBe(true)
        expect(withinMin(video, 1, [audio, video])).toBe(true)
    })
})
