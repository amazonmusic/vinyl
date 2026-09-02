/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    supportsAudioSamplingRate,
    createEmptyMediaQualityMetadata,
    throwSamplingRatesUnsupported,
} from '@amazon/vinyl'
import { MockCapabilities } from '@amazon/vinyl/vinylTestUtil'
import { setUserAgent } from '@amazon/vinyl-util'

describe('supportsAudioSamplingRate', () => {
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
                supportsAudioSamplingRate({ capabilities }, metadata, 0, [
                    metadata,
                ])
            ).toBe(false)
        })

        it('returns false when sample rate is above 48kHz even if capabilities allows it', () => {
            capabilities.sampleRate = 96_000
            const metadata = audioQuality([96_000])

            expect(
                supportsAudioSamplingRate({ capabilities }, metadata, 0, [
                    metadata,
                ])
            ).toBe(false)
        })

        it('returns false even when all rates are above 48kHz (no fallback to lowest)', () => {
            const low = audioQuality([88_200])
            const high = audioQuality([96_000])

            expect(
                supportsAudioSamplingRate({ capabilities }, low, 0, [low, high])
            ).toBe(false)

            expect(
                supportsAudioSamplingRate({ capabilities }, high, 1, [
                    low,
                    high,
                ])
            ).toBe(false)
        })

        it('returns true when sample rate is at or below supported', () => {
            const metadata = audioQuality([48_000])

            expect(
                supportsAudioSamplingRate({ capabilities }, metadata, 0, [
                    metadata,
                ])
            ).toBe(true)
        })

        it('returns true when sample rate is not set', () => {
            const metadata = audioQuality(null)

            expect(
                supportsAudioSamplingRate({ capabilities }, metadata, 0, [
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
                supportsAudioSamplingRate({ capabilities }, metadata, 0, [
                    metadata,
                ])
            ).toBe(true)
        })

        it('returns false when sample rate is above supported and others are below', () => {
            const low = audioQuality([44_100])
            const high = audioQuality([96_000])

            expect(
                supportsAudioSamplingRate({ capabilities }, high, 1, [
                    low,
                    high,
                ])
            ).toBe(false)
        })

        it('keeps lowest sample rate when all are above supported', () => {
            const low = audioQuality([88_200])
            const high = audioQuality([96_000])

            expect(
                supportsAudioSamplingRate({ capabilities }, low, 0, [low, high])
            ).toBe(true)

            expect(
                supportsAudioSamplingRate({ capabilities }, high, 1, [
                    low,
                    high,
                ])
            ).toBe(false)
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
                supportsAudioSamplingRate({ capabilities }, audio, 0, [
                    audio,
                    video,
                ])
            ).toBe(true)
            expect(
                supportsAudioSamplingRate({ capabilities }, video, 1, [
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
