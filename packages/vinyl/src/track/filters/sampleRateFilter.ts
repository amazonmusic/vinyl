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
 * Returns true when the media's sampling rate is supported.
 * If Firefox (which does not support >48kHz), filter out all sampling rates above the supported sampling rate.
 * All other browsers filter out all sampling rates above the supported sampling rate unless this will filter all
 * and then do not filter the lowest sampling rate.
 */
export function supportsAudioSamplingRate(
    deps: { readonly capabilities: Capabilities },
    metadata: MediaQualityMetadata,
    _index: number,
    array: ArrayLike<MediaQualityMetadata>
): boolean {
    const isFirefox = hasBrowser(Browser.FIREFOX)
    const maxSampleRate = deps.capabilities.sampleRate
    const samplingRate = last(metadata.audioSamplingRate)

    if (!samplingRate || !maxSampleRate) return true // sampling rate not set

    if (isFirefox) {
        // Firefox: filter out all sampling rates above 48_000 Hz
        return samplingRate <= 48_000
    }

    // Other browsers: filter out all sampling rates above supported unless this will filter all
    if (samplingRate <= maxSampleRate) return true

    // Check if filtering all would remove everything
    const allAboveMax = every(array, (item) => {
        const itemSamplingRate = last(item.audioSamplingRate)
        return itemSamplingRate != null && itemSamplingRate > maxSampleRate
    })

    if (allAboveMax) {
        // Find the lowest sampling rate and only allow that one
        const samplingRates = map(array, (item) =>
            last(item.audioSamplingRate)
        ).filter((rate): rate is number => rate != null)
        const lowestSamplingRate = min(samplingRates)
        return samplingRate === lowestSamplingRate
    }

    return false
}
