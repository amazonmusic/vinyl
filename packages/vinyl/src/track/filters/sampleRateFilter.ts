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
    every,
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
 * Both bounds are soft: if every audio rendition is above the max the lowest is
 * kept, and if every audio rendition is below the min the highest is kept, so
 * playback is never stranded. Only audio renditions count toward those
 * fallbacks — a co-present video quality (no audio rate) never influences them.
 */
export function withinAudioSampleRateRange(
    options: AudioSampleRateRangeOptions,
    metadata: MediaQualityMetadata,
    _index: number,
    array: ArrayLike<MediaQualityMetadata>
): boolean {
    // Only audio renditions are gated on sampling rate; video and any other
    // content type (including muxed video that happens to carry an audio rate)
    // pass through untouched.
    if (metadata.contentType !== 'audio') return true

    const samplingRate = last(metadata.audioSamplingRate)
    if (!samplingRate) return true // sampling rate not set

    const audioRates = () =>
        map(array, (item) =>
            item.contentType === 'audio'
                ? last(item.audioSamplingRate)
                : undefined
        ).filter((rate): rate is number => rate != null)

    // Lower bound (soft floor), independent of the platform max: below it, keep
    // only the highest when every audio rendition is below the floor.
    const { minSampleRate } = options
    if (minSampleRate != null && samplingRate < minSampleRate) {
        const rates = audioRates()
        return (
            every(rates, (rate) => rate < minSampleRate) &&
            samplingRate === max(rates)
        )
    }

    // Upper bound. An explicit maxSampleRate takes precedence over the
    // AudioContext-reported output rate.
    const maxSampleRate =
        options.maxSampleRate ?? options.capabilities.sampleRate
    // No platform max to gauge support: keep. This also lets >48kHz through on
    // Firefox (its cap below is skipped) — accepted.
    if (!maxSampleRate) return true

    if (hasBrowser(Browser.FIREFOX)) {
        // Firefox cannot decode >48kHz (e.g. high-res FLAC) via MSE; drop those.
        return samplingRate <= 48_000
    }

    if (samplingRate <= maxSampleRate) return true
    // Above the max: keep only the lowest when every audio rendition exceeds it.
    const rates = audioRates()
    return (
        every(rates, (rate) => rate > maxSampleRate) &&
        samplingRate === min(rates)
    )
}
