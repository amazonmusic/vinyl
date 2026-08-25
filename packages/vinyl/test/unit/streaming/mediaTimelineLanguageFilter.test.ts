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
    resolvePreferredLanguages,
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

/** A single-period timeline of audio qualities (one per lang) plus a video. */
function audioTimeline(langs: readonly string[]): MediaTimeline {
    return {
        periods: [
            {
                startTime: 0,
                endTime: 10,
                qualities: [
                    ...langs.map((l) => createQuality('audio', l)),
                    createQuality('video', null),
                ],
            },
        ],
        minBufferTime: 2,
        getAdBreaks: () => Promise.resolve([]),
        getDuration: () => Promise.resolve(Infinity),
    }
}

/** The audio languages kept after filtering `timeline` with `preferred`. */
function keptAudioLangs(
    timeline: MediaTimeline,
    preferred: string | readonly string[] | null
): (string | null)[] {
    return applyLanguageFilter(timeline, preferred, 'audio')
        .periods[0].qualities.filter((q) => q.metadata.contentType === 'audio')
        .map((q) => q.metadata.lang)
}

function applyLanguageFilter(
    timeline: MediaTimeline,
    preferredLanguage: string | readonly string[] | null,
    contentType: string
): MediaTimeline {
    const filter = createLanguageFilter(preferredLanguage, contentType)
    if (!filter) return timeline
    return filterTimelineQualities(filter, throwLanguagesUnsupported, timeline)
}

/** Temporarily overrides globalThis.navigator for the duration of `fn`. */
function withNavigator(nav: unknown, fn: () => void): void {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    Object.defineProperty(globalThis, 'navigator', {
        value: nav,
        configurable: true,
    })
    try {
        fn()
    } finally {
        if (original) Object.defineProperty(globalThis, 'navigator', original)
        else delete (globalThis as { navigator?: unknown }).navigator
    }
}

describe('createLanguageFilter', () => {
    it('returns null for an empty preference list', () => {
        expect(createLanguageFilter([], 'audio')).toBeNull()
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
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
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
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
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
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
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
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
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
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
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
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
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
            getAdBreaks: () => Promise.resolve([]),
            getDuration: () => Promise.resolve(Infinity),
        }
        const result = applyLanguageFilter(timeline, 'en', 'audio')
        // Period 1: filtered to 'en'
        expect(result.periods[0].qualities.length).toBe(1)
        // Period 2: no audio qualities have lang, all kept
        expect(result.periods[1].qualities.length).toBe(2)
    })

    it('prefers the first matching language in an ordered list', () => {
        const timeline = audioTimeline(['en', 'ja', 'fr'])
        expect(keptAudioLangs(timeline, ['ja', 'en'])).toEqual(['ja'])
        expect(keptAudioLangs(timeline, ['en', 'ja'])).toEqual(['en'])
    })

    it('falls through to a later preference when earlier ones are absent', () => {
        const timeline = audioTimeline(['en', 'ja'])
        expect(keptAudioLangs(timeline, ['ko', 'ja', 'en'])).toEqual(['ja'])
    })

    it('orders by navigator.languages when the preference is null', () => {
        withNavigator({ languages: ['ja-JP', 'en-US'] }, () => {
            const timeline = audioTimeline(['en', 'ja'])
            expect(keptAudioLangs(timeline, null)).toEqual(['ja'])
        })
    })

    it('returns null when null and navigator is unavailable', () => {
        withNavigator(undefined, () => {
            expect(createLanguageFilter(null, 'audio')).toBeNull()
        })
    })
})

describe('resolvePreferredLanguages', () => {
    it('wraps a single string in a one-element list', () => {
        expect(resolvePreferredLanguages('en')).toEqual(['en'])
    })

    it('returns an array preference as-is (already ordered)', () => {
        expect(resolvePreferredLanguages(['ja', 'en'])).toEqual(['ja', 'en'])
    })

    it('falls back to navigator.languages when null', () => {
        withNavigator({ languages: ['ja-JP', 'en-US'] }, () => {
            expect(resolvePreferredLanguages(null)).toEqual(['ja-JP', 'en-US'])
        })
    })

    it('returns an empty list when null and navigator is unavailable', () => {
        withNavigator(undefined, () => {
            expect(resolvePreferredLanguages(null)).toEqual([])
        })
    })

    it('returns an empty list for an empty array', () => {
        expect(resolvePreferredLanguages([])).toEqual([])
    })
})
