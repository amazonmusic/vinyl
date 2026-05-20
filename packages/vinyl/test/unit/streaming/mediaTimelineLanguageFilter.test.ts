/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createEmptyMediaQualityMetadata,
    createLanguageFilter,
    filterTimelineQualities,
    type MediaQualityData,
    type MediaTimeline,
} from '@amazon/vinyl'
import { throwLanguagesUnsupported } from '@amazon/vinyl'

function createQuality(
    contentType: 'audio' | 'video',
    lang: string | null
): MediaQualityData {
    return {
        metadata: {
            ...createEmptyMediaQualityMetadata(),
            contentType,
            lang,
        },
        getSegment: () => Promise.resolve(null),
    }
}

function applyLanguageFilter(
    timeline: MediaTimeline,
    preferredLanguage: string | null,
    contentType: string
): MediaTimeline {
    const filter = createLanguageFilter(preferredLanguage, contentType)
    if (!filter) return timeline
    return filterTimelineQualities(filter, throwLanguagesUnsupported, timeline)
}

describe('createLanguageFilter', () => {
    it('returns null when preferredLanguage is null', () => {
        expect(createLanguageFilter(null, 'audio')).toBeNull()
    })

    it('returns a filter predicate when preferredLanguage is set', () => {
        expect(createLanguageFilter('en', 'audio')).toEqual(
            jasmine.any(Function)
        )
    })

    it('filters to matching language', () => {
        const timeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 10,
                    qualities: [
                        createQuality('audio', 'en'),
                        createQuality('audio', 'ja'),
                        createQuality('video', null),
                    ],
                },
            ],
            minBufferTime: 2,
        }
        const result = applyLanguageFilter(timeline, 'en', 'audio')
        expect(result.periods[0].qualities.length).toBe(2) // en audio + video
    })

    it('keeps qualities without language tag', () => {
        const timeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 10,
                    qualities: [
                        createQuality('audio', 'en'),
                        createQuality('audio', null),
                        createQuality('audio', 'ja'),
                    ],
                },
            ],
            minBufferTime: 2,
        }
        const result = applyLanguageFilter(timeline, 'en', 'audio')
        expect(result.periods[0].qualities.length).toBe(2) // en + null
    })

    it('preserves minBufferTime', () => {
        const timeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 10,
                    qualities: [createQuality('audio', 'en')],
                },
            ],
            minBufferTime: 5,
        }
        const result = applyLanguageFilter(timeline, 'en', 'audio')
        expect(result.minBufferTime).toBe(5)
    })

    it('does not filter non-matching content types', () => {
        const timeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 10,
                    qualities: [
                        createQuality('audio', 'en'),
                        createQuality('audio', 'ja'),
                        createQuality('video', null),
                    ],
                },
            ],
            minBufferTime: 2,
        }
        const result = applyLanguageFilter(timeline, 'en', 'audio')
        expect(
            result.periods[0].qualities.some(
                (q) => q.metadata.contentType === 'video'
            )
        ).toBeTrue()
    })

    it('keeps all when no language matches in a period', () => {
        const timeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 10,
                    qualities: [createQuality('audio', 'ja')],
                },
            ],
            minBufferTime: 2,
        }
        // 'xx' doesn't match 'ja', so all kept
        const result = applyLanguageFilter(timeline, 'xx', 'audio')
        expect(result.periods[0].qualities.length).toBe(1)
    })

    it('filters per period independently when periods have different languages', () => {
        const timeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 10,
                    qualities: [
                        createQuality('audio', 'en'),
                        createQuality('audio', 'ja'),
                    ],
                },
                {
                    startTime: 10,
                    endTime: 20,
                    qualities: [
                        createQuality('audio', 'fr'),
                        createQuality('audio', 'de'),
                    ],
                },
            ],
            minBufferTime: 2,
        }
        // 'en' matches period 1 but not period 2
        // Period 1: filtered to 'en' only
        // Period 2: no match, so all kept (fr + de)
        const result = applyLanguageFilter(timeline, 'en', 'audio')
        expect(result.periods[0].qualities.length).toBe(1)
        expect(result.periods[0].qualities[0].metadata.lang).toBe('en')
        expect(result.periods[1].qualities.length).toBe(2)
    })

    it('keeps all qualities when no quality in the period has a language', () => {
        const timeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 10,
                    qualities: [
                        createQuality('audio', 'en'),
                        createQuality('audio', 'ja'),
                    ],
                },
                {
                    startTime: 10,
                    endTime: 20,
                    qualities: [
                        createQuality('audio', null),
                        createQuality('video', null),
                    ],
                },
            ],
            minBufferTime: 2,
        }
        const result = applyLanguageFilter(timeline, 'en', 'audio')
        // Period 1: filtered to 'en'
        expect(result.periods[0].qualities.length).toBe(1)
        // Period 2: no audio qualities have lang, all kept
        expect(result.periods[1].qualities.length).toBe(2)
    })
})
