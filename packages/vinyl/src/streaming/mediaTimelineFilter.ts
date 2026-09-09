/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    MediaPeriod,
    MediaQualityData,
    MediaTimeline,
} from './MediaTimeline'
import type { MediaQualityMetadata } from './MediaQualityMetadata'
import { RESTRICTABLE_CONTENT_TYPES } from './MediaQualityMetadata'
import type {
    FilterPredicate,
    FilterPredicateAsync,
    Maybe,
} from '@amazon/vinyl-util'
import { map, memoize } from '@amazon/vinyl-util'

/**
 * Throws via `throwError` when filtering drops every rendition of an audio or
 * video stream the period originally carried. Each surviving media stream needs
 * a source buffer to append to; a stream filtered to zero can never create one,
 * stalling playback on an unfulfilled `readyToAppend`, so a whole-stream drop is
 * treated as unsupported media rather than a silent stall. Text is excluded —
 * captions are an optional sidecar pipeline, not an MSE source buffer.
 */
function assertMediaStreamsRetained(
    original: readonly MediaQualityData[],
    filtered: readonly MediaQualityData[],
    throwError: () => never
): void {
    for (const contentType of RESTRICTABLE_CONTENT_TYPES) {
        if (
            original.some((q) => q.metadata.contentType === contentType) &&
            !filtered.some((q) => q.metadata.contentType === contentType)
        ) {
            throwError()
        }
    }
}

/**
 * Filters qualities in a MediaTimeline using a synchronous predicate.
 * If filtering drops an audio or video stream to zero in any period, throws via
 * `throwError`.
 */
export function filterTimelineQualities(
    filter: Maybe<FilterPredicate<MediaQualityMetadata>>,
    throwError: () => never,
    timeline: MediaTimeline
): MediaTimeline {
    if (!filter) return timeline
    const mapMetadataArray = memoize(
        (qualities: readonly MediaQualityData[]) =>
            map(qualities, (q) => q.metadata),
        (qualities) => qualities,
        1
    )

    const periods = timeline.periods.map((period) => {
        const filtered = period.qualities.filter((q, index) =>
            filter(q.metadata, index, mapMetadataArray(period.qualities))
        )
        assertMediaStreamsRetained(period.qualities, filtered, throwError)
        return { ...period, qualities: filtered }
    })

    return { ...timeline, periods }
}

/**
 * Filters qualities in a MediaTimeline using an asynchronous predicate.
 * If filtering drops an audio or video stream to zero in any period, throws via
 * `throwError`.
 */
export async function filterTimelineQualitiesAsync(
    filter: FilterPredicateAsync<MediaQualityMetadata>,
    throwError: () => never,
    timeline: MediaTimeline
): Promise<MediaTimeline> {
    const mapMetadataArray = memoize(
        (qualities: readonly MediaQualityData[]) =>
            map(qualities, (q) => q.metadata),
        (qualities) => qualities,
        1
    )

    const periods: MediaPeriod[] = []
    for (const period of timeline.periods) {
        const filtered: MediaQualityData[] = []
        const metadataArray = mapMetadataArray(period.qualities)
        for (let i = 0; i < period.qualities.length; i++) {
            if (await filter(period.qualities[i].metadata, i, metadataArray)) {
                filtered.push(period.qualities[i])
            }
        }
        assertMediaStreamsRetained(period.qualities, filtered, throwError)
        periods.push({ ...period, qualities: filtered })
    }

    return { ...timeline, periods }
}

/**
 * Creates a language filter predicate for use with filterTimelineQualities.
 */
export { createLanguageFilter } from './mediaTimelineLanguageFilter'
