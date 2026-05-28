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
import type {
    FilterPredicate,
    FilterPredicateAsync,
    Maybe,
} from '@amazon/vinyl-util'
import { map, memoize } from '@amazon/vinyl-util'

/**
 * Filters qualities in a MediaTimeline using a synchronous predicate.
 * If filtering would remove all qualities from any period, throws via `throwError`.
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
        return { ...period, qualities: filtered }
    })

    if (periods.some((p) => p.qualities.length === 0)) {
        throwError()
    }

    return { ...timeline, periods }
}

/**
 * Filters qualities in a MediaTimeline using an asynchronous predicate.
 * If filtering would remove all qualities from any period, throws via `throwError`.
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
        periods.push({ ...period, qualities: filtered })
    }

    if (periods.some((p) => p.qualities.length === 0)) {
        throwError()
    }

    return { ...timeline, periods }
}

/**
 * Creates a language filter predicate for use with filterTimelineQualities.
 */
export { createLanguageFilter } from './mediaTimelineLanguageFilter'
