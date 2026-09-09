/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MediaQualityMetadata } from '../../streaming/MediaQualityMetadata'
import {
    hasBrowser,
    Browser,
    last,
    MediaUnsupportedError,
    map,
    max,
    min,
} from '@amazon/vinyl-util'
import type { Capabilities } from '../../client/Capabilities'

export function throwSamplingRatesUnsupported(): never {
    throw new MediaUnsupportedError('No supported sample rate', 'sampling-rate')
}

export interface AudioSampleRateRangeOptions {
    readonly capabilities: Capabilities
    /**
     * An explicit maximum sampling rate that takes precedence over the
     * platform's `AudioContext`-reported output rate when set.
     */
    readonly maxSampleRate?: number | null
    /** An optional minimum sampling-rate floor. */
    readonly minSampleRate?: number | null
}

/**
 * Returns true when the media's sampling rate is within the supported range.
 * Only audio content types are gated; every other content type passes through.
 *
 * The upper bound is `maxSampleRate` when set, otherwise the platform's
 * `AudioContext`-reported output rate (Firefox is hard-capped at 48kHz, which it
 * cannot decode beyond via MSE). The optional lower bound is `minSampleRate`.
 * Both bounds are soft, and soft *together*: when no audio rendition sits in the
 * acceptable `[minSampleRate, maxSampleRate]` band, a single fallback is kept so
 * playback is never stranded — the highest rate the ceiling can decode, or, when
 * every rate is above the ceiling, the lowest. This holds even when renditions
 * straddle an empty band (some below the floor, some above the ceiling). Only
 * audio renditions count toward the fallback — a co-present video quality (no
 * audio rate) never influences it. Firefox is the exception: its 48kHz cap is
 * hard, with no fallback.
 */
export function withinAudioSampleRateRange(
    options: AudioSampleRateRangeOptions,
    metadata: MediaQualityMetadata,
    _index: number,
    array: ArrayLike<MediaQualityMetadata>
): boolean {
    // Muxed video carrying an audio rate, and every non-audio type, pass through.
    if (metadata.contentType !== 'audio') return true

    const samplingRate = last(metadata.audioSamplingRate)
    if (!samplingRate) return true // sampling rate not set

    const { minSampleRate } = options
    // An explicit maxSampleRate takes precedence over the AudioContext rate.
    const maxSampleRate =
        options.maxSampleRate ?? options.capabilities.sampleRate

    const audioRates = (): number[] =>
        map(array, (item) =>
            item.contentType === 'audio'
                ? last(item.audioSamplingRate)
                : undefined
        ).filter((rate): rate is number => rate != null)

    // The single rate to keep when this rendition is out of band — or undefined
    // when some rendition IS in band, so out-of-band renditions are dropped.
    // Evaluating both bounds together is what stops a straddle from stranding.
    const outOfBandFallback = (): number | undefined => {
        const rates = audioRates()
        const inBand = (rate: number): boolean =>
            (minSampleRate == null || rate >= minSampleRate) &&
            (!maxSampleRate || rate <= maxSampleRate)
        if (rates.some(inBand)) return undefined
        const decodable = maxSampleRate
            ? rates.filter((rate) => rate <= maxSampleRate)
            : rates
        return decodable.length ? max(decodable) : min(rates)
    }

    // Lower bound (soft floor), independent of the platform max.
    if (minSampleRate != null && samplingRate < minSampleRate) {
        return samplingRate === outOfBandFallback()
    }

    // No platform max to gauge support: keep. This also lets >48kHz through on
    // Firefox (its cap below is skipped) — accepted.
    if (!maxSampleRate) return true

    if (hasBrowser(Browser.FIREFOX)) {
        // Firefox cannot decode >48kHz (e.g. high-res FLAC) via MSE; drop those.
        return samplingRate <= 48_000
    }

    if (samplingRate <= maxSampleRate) return true
    // Above the ceiling (soft): keep only the fallback when no rate is in band.
    return samplingRate === outOfBandFallback()
}
