/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { buildSegmentTimeline } from '@amazon/vinyl'
import type { HlsSegment } from '@amazon/vinyl-hls-parser'

import createSpy = jasmine.createSpy

describe('buildSegmentTimeline', () => {
    const deps = {
        requestInterceptor: createSpy('requestInterceptor'),
        segmentRequestInit: undefined,
    }
    const baseUrl = 'https://example.com/media/'

    function segment(
        uri: string,
        duration: number,
        byteRange?: { length: number; offset: number }
    ): HlsSegment {
        return {
            uri,
            duration,
            sequenceNumber: 0,
            discontinuity: false,
            ...(byteRange && { byteRange }),
        }
    }

    it('returns empty array for empty segments', () => {
        expect(buildSegmentTimeline(deps, baseUrl, [])).toEqual([])
    })

    it('builds cumulative start and end times', () => {
        const segments = [
            segment('seg0.mp4', 6),
            segment('seg1.mp4', 4),
            segment('seg2.mp4', 5),
        ]
        const timeline = buildSegmentTimeline(deps, baseUrl, segments)

        expect(timeline.length).toBe(3)
        expect(timeline[0].startTime).toBe(0)
        expect(timeline[0].endTime).toBe(6)
        expect(timeline[1].startTime).toBe(6)
        expect(timeline[1].endTime).toBe(10)
        expect(timeline[2].startTime).toBe(10)
        expect(timeline[2].endTime).toBe(15)
    })

    it('sets timestampOffset equal to startTime', () => {
        const segments = [segment('seg0.mp4', 6), segment('seg1.mp4', 4)]
        const timeline = buildSegmentTimeline(deps, baseUrl, segments)

        expect(timeline[0].timestampOffset).toBe(0)
        expect(timeline[1].timestampOffset).toBe(6)
    })

    it('creates a data provider for each segment', () => {
        const segments = [segment('seg0.mp4', 6)]
        const timeline = buildSegmentTimeline(deps, baseUrl, segments)

        expect(typeof timeline[0].data).toBe('function')
    })

    it('passes byteRange as mediaRange when present', () => {
        const segments = [segment('seg0.mp4', 6, { offset: 100, length: 200 })]
        const timeline = buildSegmentTimeline(deps, baseUrl, segments)

        expect(typeof timeline[0].data).toBe('function')
    })
})
