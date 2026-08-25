/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MediaQualityMetadata } from './MediaQualityMetadata'
import type { FilterPredicate } from '@amazon/vinyl-util'
import { memoize } from '@amazon/vinyl-util'
import { languageRelatedness } from '../track/filters/languageFilter'

/**
 * Resolves the preferred-language option to an ordered list of BCP 47 tags,
 * most-preferred first.
 *
 * - a string becomes a single-element list
 * - an array is used as-is (already ordered)
 * - `null` falls back to the platform's `navigator.languages` order — `null`
 *   means "use the platform preference", not "no preference"
 * - an empty list (empty array, or `navigator.languages` unavailable) means no
 *   preference: keep all languages
 */
export function resolvePreferredLanguages(
    preferred: string | readonly string[] | null
): readonly string[] {
    if (typeof preferred === 'string') return [preferred]
    if (preferred) return preferred
    if (typeof navigator !== 'undefined') return [...navigator.languages]
    return []
}

/**
 * Creates a filter predicate that keeps the qualities best matching the
 * preferred language(s). The preference is an ordered list (see
 * {@link resolvePreferredLanguages}): earlier entries win, and relatedness
 * (exact > parent > sibling > child) breaks ties within a single preference.
 *
 * The best match is computed per period (per unique array reference), so
 * periods with different available languages are handled independently. When no
 * available language relates to any preference, all are kept (playback is never
 * stranded). Qualities not matching the content type, or without a language
 * tag, are always kept.
 *
 * @param preferredLanguage BCP 47 tag, ordered list of tags, or null (which
 *   falls back to `navigator.languages`).
 * @param contentType Only filter qualities matching this content type (e.g. 'audio').
 */
export function createLanguageFilter(
    preferredLanguage: string | readonly string[] | null,
    contentType: string
): FilterPredicate<MediaQualityMetadata> | null {
    const preferences = resolvePreferredLanguages(preferredLanguage)
    if (preferences.length === 0) return null

    // Ranks a language against the ordered preference list. Earlier preferences
    // dominate (weighted by list position); relatedness breaks ties within one.
    // 0 means the language is unrelated to every preference.
    const scoreLang = (lang: string): number => {
        let best = 0
        for (let i = 0; i < preferences.length; i++) {
            const rel = languageRelatedness(preferences[i], lang)
            if (rel > 0) {
                best = Math.max(best, (preferences.length - i) * 10 + rel)
            }
        }
        return best
    }

    // The best score among the period's languages, memoized per unique array.
    const bestScoreForPeriod = memoize(
        (array: ArrayLike<MediaQualityMetadata>) => {
            let best = 0
            for (const quality of Array.from(array)) {
                if (quality.contentType === contentType && quality.lang) {
                    best = Math.max(best, scoreLang(quality.lang))
                }
            }
            return best
        },
        (array) => array,
        1
    )

    return (quality, _index, array) => {
        if (quality.contentType !== contentType) return true
        if (!quality.lang) return true
        const best = bestScoreForPeriod(array)
        // Nothing matched any preference; keep all rather than strand playback.
        if (best === 0) return true
        return scoreLang(quality.lang) === best
    }
}
