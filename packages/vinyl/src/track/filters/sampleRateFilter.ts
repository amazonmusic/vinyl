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
    min,
} from '@amazon/vinyl-util'
import type { Capabilities } from '../../client/Capabilities'

export function throwSamplingRatesUnsupported(): never {
    throw new MediaUnsupportedError('No supported sample rate', 'sampling-rate')
}

/**
 * Returns true when the media's sampling rate is supported. Only audio content
 * types are gated; every other content type passes through.
 * If Firefox (which does not support >48kHz), filter out all sampling rates above the supported sampling rate.
 * All other browsers filter out all sampling rates above the supported sampling rate unless this will filter all
 * and then do not filter the lowest sampling rate.
 */
export function supportsAudioSamplingRate(
    deps: {
        readonly capabilities: Capabilities
        /**
         * An explicit maximum sampling rate that takes precedence over the
         * platform's `AudioContext`-reported output rate when set.
         */
        readonly maxSampleRate?: number | null
    },
    metadata: MediaQualityMetadata,
    _index: number,
    array: ArrayLike<MediaQualityMetadata>
): boolean {
    // Only audio renditions are gated on sampling rate; video and any other
    // content type (including muxed video that happens to carry an audio rate)
    // pass through untouched.
    if (metadata.contentType !== 'audio') return true

    const isFirefox = hasBrowser(Browser.FIREFOX)
    // An explicit maxSampleRate takes precedence over the AudioContext-reported
    // output rate.
    const maxSampleRate = deps.maxSampleRate ?? deps.capabilities.sampleRate
    const samplingRate = last(metadata.audioSamplingRate)

    // Unknown rate, or no AudioContext to gauge platform support: keep. This
    // also lets >48kHz through on Firefox (its cap below is skipped) — accepted.
    if (!samplingRate || !maxSampleRate) return true

    if (isFirefox) {
        // Firefox cannot decode >48kHz (e.g. high-res FLAC) via MSE; drop those.
        return samplingRate <= 48_000
    }

    // Other browsers: filter out all sampling rates above supported unless this will filter all
    if (samplingRate <= maxSampleRate) return true

    // Every audio rendition exceeds the platform max: keep the lowest so
    // playback isn't stranded. Only audio qualities are considered — other
    // content types (e.g. a co-present video rendition with no audio rate)
    // aren't gated here and must not influence the fallback.
    const audioSamplingRates = map(array, (item) =>
        item.contentType === 'audio' ? last(item.audioSamplingRate) : undefined
    ).filter((rate): rate is number => rate != null)

    const allAboveMax = every(
        audioSamplingRates,
        (rate) => rate > maxSampleRate
    )

    if (allAboveMax) {
        // Find the lowest sampling rate and only allow that one
        return samplingRate === min(audioSamplingRates)
    }

    return false
}
