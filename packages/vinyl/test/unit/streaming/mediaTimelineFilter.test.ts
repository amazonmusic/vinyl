/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createEmptyMediaQualityMetadata,
    filterTimelineQualities,
    filterTimelineQualitiesAsync,
    type MediaQualityData,
    type MediaTimeline,
} from '@amazon/vinyl'

function createQuality(
    contentType: 'audio' | 'video',
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

describe('filterTimelineQualities', () => {
    const timeline: MediaTimeline = {
        periods: [
            {
                startTime: 0,
                endTime: 10,
                qualities: [
                    createQuality('audio', 128000),
                    createQuality('audio', 256000),
                    createQuality('video', 500000),
                ],
            },
        ],
        minBufferTime: 2,
        getAdBreaks: () => Promise.resolve([]),
        getDuration: () => Promise.resolve(Infinity),
    }

    it('returns the timeline unchanged when the filter is null', () => {
        // A null predicate (e.g. no language preference) is a no-op.
        const result = filterTimelineQualities(
            null,
            () => {
                throw new Error('empty')
            },
            timeline
        )
        expect(result).toBe(timeline)
    })

    it('filters qualities by predicate', () => {
        const result = filterTimelineQualities(
            (q) => q.contentType === 'audio',
            () => {
                throw new Error('empty')
            },
            timeline
        )
        expect(result.periods[0].qualities.length).toBe(2)
        expect(
            result.periods[0].qualities.every(
                (q) => q.metadata.contentType === 'audio'
            )
        ).toBeTrue()
    })

    it('preserves minBufferTime', () => {
        const result = filterTimelineQualities(
            () => true,
            () => {
                throw new Error('empty')
            },
            timeline
        )
        expect(result.minBufferTime).toBe(2)
    })

    it('throws when filtering removes all qualities', () => {
        expect(() =>
            filterTimelineQualities(
                () => false,
                () => {
                    throw new Error('no qualities')
                },
                timeline
            )
        ).toThrowError('no qualities')
    })
})

describe('filterTimelineQualitiesAsync', () => {
    const timeline: MediaTimeline = {
        periods: [
            {
                startTime: 0,
                endTime: 10,
                qualities: [
                    createQuality('audio', 128000),
                    createQuality('video', 500000),
                ],
            },
        ],
        minBufferTime: 2,
        getAdBreaks: () => Promise.resolve([]),
        getDuration: () => Promise.resolve(Infinity),
    }

    it('filters qualities by async predicate', async () => {
        const result = await filterTimelineQualitiesAsync(
            (q) => Promise.resolve(q.contentType === 'audio'),
            () => {
                throw new Error('empty')
            },
            timeline
        )
        expect(result.periods[0].qualities.length).toBe(1)
        expect(result.periods[0].qualities[0].metadata.contentType).toBe(
            'audio'
        )
    })

    it('preserves minBufferTime', async () => {
        const result = await filterTimelineQualitiesAsync(
            () => Promise.resolve(true),
            () => {
                throw new Error('empty')
            },
            timeline
        )
        expect(result.minBufferTime).toBe(2)
    })

    it('throws when filtering removes all qualities', async () => {
        await expectAsync(
            filterTimelineQualitiesAsync(
                () => Promise.resolve(false),
                () => {
                    throw new Error('no qualities')
                },
                timeline
            )
        ).toBeRejectedWithError('no qualities')
    })
})
