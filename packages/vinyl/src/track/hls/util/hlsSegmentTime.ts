/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HlsSegment } from '@amazon/vinyl-hls-parser'
import type { MediaSegmentReference } from '@/streaming/SegmentReference'
import type { SegmentDataProvider } from '@/streaming/SegmentDataSlot'
import {
    createSegmentDataProvider,
    type CreateSegmentDataProviderDeps,
} from '@/track/createSegmentDataProvider'
import { hlsByteRangeToMediaRange } from './hlsByteRangeToMediaRange'
import { resolveUrl } from '@amazon/vinyl-util'

/**
 * Builds a timeline of MediaSegmentReferences from an HLS media playlist's
 * segment list. Cumulative durations are used to compute start/end times.
 */
export function buildSegmentTimeline(
    deps: CreateSegmentDataProviderDeps,
    baseUrl: string,
    segments: readonly HlsSegment[]
): readonly MediaSegmentReference<SegmentDataProvider>[] {
    const out: MediaSegmentReference<SegmentDataProvider>[] = new Array(
        segments.length
    )
    let time = 0
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        const startTime = time
        const endTime = time + seg.duration
        const url = resolveUrl(seg.uri, baseUrl)
        out[i] = {
            timestampOffset: startTime,
            startTime,
            endTime,
            data: createSegmentDataProvider(deps, {
                url,
                mediaRange: seg.byteRange
                    ? hlsByteRangeToMediaRange(seg.byteRange)
                    : undefined,
                reportDownlinkMetrics: true,
            }),
        }
        time = endTime
    }
    return out
}
