/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createEmptyMediaQualityMetadata,
    filterTimelineQualities,
    filterTimelineQualitiesAsync,
    type ContentType,
    type MediaQualityData,
    type MediaTimeline,
} from '@amazon/vinyl'

function createQuality(
    contentType: ContentType,
    bandwidth: number
): MediaQualityData {
    return {
        metadata: {
            ...createEmptyMediaQualityMetadata(),
            contentType,
            bandwidth,
        },
        getSegment: () => Promise.resolve(null),
    }
}

function timelineOf(qualities: readonly MediaQualityData[]): MediaTimeline {
    return {
        periods: [{ startTime: 0, endTime: 10, qualities: [...qualities] }],
        minBufferTime: 2,
        getAdBreaks: () => Promise.resolve([]),
        getDuration: () => Promise.resolve(Infinity),
    }
}

function contentTypesOf(timeline: MediaTimeline): Set<ContentType | null> {
    return new Set(
        timeline.periods[0].qualities.map((q) => q.metadata.contentType)
    )
}

function throwEmpty(): never {
    throw new Error('no qualities')
}

describe('filterTimelineQualities', () => {
    const timeline = timelineOf([
        createQuality('audio', 128000),
        createQuality('audio', 256000),
        createQuality('video', 500000),
    ])

    it('returns the timeline unchanged when the filter is null', () => {
        // A null predicate (e.g. no language preference) is a no-op.
        const result = filterTimelineQualities(null, throwEmpty, timeline)
        expect(result).toBe(timeline)
    })

    it('filters qualities by predicate while keeping every present stream', () => {
        const result = filterTimelineQualities(
            (q) => q.bandwidth !== 256000,
            throwEmpty,
            timeline
        )
        expect(result.periods[0].qualities.length).toBe(2)
        expect(contentTypesOf(result)).toEqual(new Set(['audio', 'video']))
    })

    it('preserves minBufferTime', () => {
        const result = filterTimelineQualities(() => true, throwEmpty, timeline)
        expect(result.minBufferTime).toBe(2)
    })

    it('throws when filtering removes all qualities', () => {
        expect(() =>
            filterTimelineQualities(() => false, throwEmpty, timeline)
        ).toThrowError('no qualities')
    })

    it('throws when filtering drops a present video stream to zero', () => {
        expect(() =>
            filterTimelineQualities(
                (q) => q.contentType === 'audio',
                throwEmpty,
                timeline
            )
        ).toThrowError('no qualities')
    })

    it('throws when filtering drops a present audio stream to zero', () => {
        expect(() =>
            filterTimelineQualities(
                (q) => q.contentType === 'video',
                throwEmpty,
                timeline
            )
        ).toThrowError('no qualities')
    })

    it('does not throw when losing only an optional text sidecar stream', () => {
        const withText = timelineOf([
            createQuality('audio', 128000),
            createQuality('video', 500000),
            createQuality('text', 1000),
        ])
        const result = filterTimelineQualities(
            (q) => q.contentType !== 'text',
            throwEmpty,
            withText
        )
        expect(contentTypesOf(result)).toEqual(new Set(['audio', 'video']))
    })
})

describe('filterTimelineQualitiesAsync', () => {
    const timeline = timelineOf([
        createQuality('audio', 128000),
        createQuality('audio', 256000),
        createQuality('video', 500000),
    ])

    it('filters qualities by async predicate while keeping every present stream', async () => {
        const result = await filterTimelineQualitiesAsync(
            (q) => Promise.resolve(q.bandwidth !== 256000),
            throwEmpty,
            timeline
        )
        expect(result.periods[0].qualities.length).toBe(2)
        expect(contentTypesOf(result)).toEqual(new Set(['audio', 'video']))
    })

    it('preserves minBufferTime', async () => {
        const result = await filterTimelineQualitiesAsync(
            () => Promise.resolve(true),
            throwEmpty,
            timeline
        )
        expect(result.minBufferTime).toBe(2)
    })

    it('throws when filtering removes all qualities', async () => {
        await expectAsync(
            filterTimelineQualitiesAsync(
                () => Promise.resolve(false),
                throwEmpty,
                timeline
            )
        ).toBeRejectedWithError('no qualities')
    })

    it('throws when filtering drops a present video stream to zero', async () => {
        await expectAsync(
            filterTimelineQualitiesAsync(
                (q) => Promise.resolve(q.contentType === 'audio'),
                throwEmpty,
                timeline
            )
        ).toBeRejectedWithError('no qualities')
    })

    it('does not throw when losing only an optional text sidecar stream', async () => {
        const withText = timelineOf([
            createQuality('audio', 128000),
            createQuality('video', 500000),
            createQuality('text', 1000),
        ])
        const result = await filterTimelineQualitiesAsync(
            (q) => Promise.resolve(q.contentType !== 'text'),
            throwEmpty,
            withText
        )
        expect(contentTypesOf(result)).toEqual(new Set(['audio', 'video']))
    })
})
