/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createAudioDescriptionFilter,
    createEmptyMediaQualityMetadata,
    filterTimelineQualities,
    isAudioDescription,
    type MediaQualityData,
    type MediaTimeline,
    throwNoPlayableAudio,
} from '@amazon/vinyl'

function audioQuality(
    id: string,
    characteristics: readonly string[]
): MediaQualityData {
    return {
        metadata: {
            ...createEmptyMediaQualityMetadata(),
            qualityId: id,
            contentType: 'audio',
            lang: 'en',
            characteristics,
        },
        getSegment: () => Promise.resolve(null),
    }
}

function videoQuality(): MediaQualityData {
    return {
        metadata: {
            ...createEmptyMediaQualityMetadata(),
            qualityId: 'video',
            contentType: 'video',
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

/** The audio qualityIds kept after applying the filter. */
function keptAudio(
    qualities: readonly MediaQualityData[],
    preferDescription: boolean
): string[] {
    const filtered = filterTimelineQualities(
        createAudioDescriptionFilter(preferDescription),
        throwNoPlayableAudio,
        timelineOf(qualities)
    )
    return filtered.periods[0].qualities
        .filter((q) => q.metadata.contentType === 'audio')
        .map((q) => q.metadata.qualityId)
}

const DVS = 'public.accessibility.describes-video'

describe('isAudioDescription', () => {
    it('detects the HLS describes-video characteristic', () => {
        expect(
            isAudioDescription({
                ...createEmptyMediaQualityMetadata(),
                characteristics: [DVS],
            })
        ).toBeTrue()
    })

    it('detects the DASH description role', () => {
        expect(
            isAudioDescription({
                ...createEmptyMediaQualityMetadata(),
                characteristics: ['description'],
            })
        ).toBeTrue()
    })

    it('is false for a plain rendition', () => {
        expect(
            isAudioDescription(createEmptyMediaQualityMetadata())
        ).toBeFalse()
    })
})

describe('createAudioDescriptionFilter', () => {
    it('drops the description track when a main alternative exists (default)', () => {
        const kept = keptAudio(
            [
                audioQuality('dvs', [DVS]),
                audioQuality('main', []),
                videoQuality(),
            ],
            false
        )
        expect(kept).toEqual(['main'])
    })

    it('keeps the description track when it is the only audio (never strands)', () => {
        const kept = keptAudio(
            [audioQuality('dvs', [DVS]), videoQuality()],
            false
        )
        expect(kept).toEqual(['dvs'])
    })

    it('keeps only the description track when opted in', () => {
        const kept = keptAudio(
            [
                audioQuality('dvs', [DVS]),
                audioQuality('main', []),
                videoQuality(),
            ],
            true
        )
        expect(kept).toEqual(['dvs'])
    })

    it('keeps all audio when opted in but no description exists', () => {
        const kept = keptAudio(
            [audioQuality('a', []), audioQuality('b', []), videoQuality()],
            true
        )
        expect(kept).toEqual(['a', 'b'])
    })

    it('leaves non-audio qualities untouched', () => {
        const filtered = filterTimelineQualities(
            createAudioDescriptionFilter(false),
            throwNoPlayableAudio,
            timelineOf([
                audioQuality('dvs', [DVS]),
                audioQuality('main', []),
                videoQuality(),
            ])
        )
        expect(
            filtered.periods[0].qualities.some(
                (q) => q.metadata.contentType === 'video'
            )
        ).toBeTrue()
    })
})
