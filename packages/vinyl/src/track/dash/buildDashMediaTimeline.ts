/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DashManifestData } from '@/track/dash/DashManifestProvider'
import type {
    MediaPeriod,
    MediaQualityData,
    MediaTimeline,
} from '@/streaming/MediaTimeline'
import type { RepresentationType } from '@amazon/vinyl-mpd-parser'
import {
    calculateDuration,
    calculatePeriodEnd,
    calculatePeriodStart,
    flattenRepresentations,
} from '@/track/dash/util/mpd'
import {
    createDashRepresentationSegmentProvider,
    type DashSegmentProviderDeps,
} from '@/track/dash/timeline/DashRepresentationSegmentProvider'

export type BuildDashMediaTimelineDeps = DashSegmentProviderDeps

/**
 * Builds a MediaTimeline from a Dash manifest.
 */
export function buildDashMediaTimeline(
    deps: BuildDashMediaTimelineDeps,
    data: DashManifestData
): MediaTimeline {
    const { manifest, baseUrl } = data
    const periods: MediaPeriod[] = manifest.MPD.Period.map((period) => {
        const startTime = calculatePeriodStart(period)
        const endTime = calculatePeriodEnd(period) ?? Infinity
        const representations = flattenRepresentations(period)
        const qualities: MediaQualityData[] = representations.map(
            (representation: RepresentationType): MediaQualityData => {
                const metadata =
                    deps.mediaQualityMetadataResolver(representation)
                const segmentProvider = createDashRepresentationSegmentProvider(
                    deps,
                    baseUrl,
                    representation
                )
                return {
                    metadata,
                    getSegment: (time: number, affordance?: number) =>
                        segmentProvider.getSegment(time, affordance),
                }
            }
        )
        return { startTime, endTime, qualities }
    })
    const duration = calculateDuration(manifest)
    return {
        periods,
        minBufferTime: manifest.MPD.minBufferTime,
        getDuration: () => Promise.resolve(duration),
    }
}
