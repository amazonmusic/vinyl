/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MediaQualityMetadata } from './MediaQualityMetadata'
import type { FilterPredicate } from '@amazon/vinyl-util'
import { memoize } from '@amazon/vinyl-util'
import {
    findBestLanguageMatch,
    languageRelatedness,
} from '../track/filters/languageFilter'

/**
 * Creates a filter predicate that keeps qualities matching the preferred language.
 * The best language match is computed per period (per unique array reference),
 * so periods with different available languages are handled independently.
 *
 * Qualities not matching the content type or without a language tag are always kept.
 *
 * @param preferredLanguage BCP 47 language tag, or null to keep all.
 * @param contentType Only filter qualities matching this content type (e.g. 'audio').
 */
export function createLanguageFilter(
    preferredLanguage: string | null,
    contentType: string
): FilterPredicate<MediaQualityMetadata> | null {
    if (!preferredLanguage) return null

    // Finds the best language for the period by relevance.
    // If no languages are related, the first language will be chosen.
    const bestRelevanceForPeriod = memoize(
        (array: ArrayLike<MediaQualityMetadata>) => {
            const langs = Array.from(array)
                .filter((q) => q.contentType === contentType && q.lang)
                .map((q) => q.lang!)
            return languageRelatedness(
                preferredLanguage,
                findBestLanguageMatch(preferredLanguage, langs)!
            )
        },
        (array) => array,
        1
    )

    return (quality, _index, array) => {
        if (quality.contentType !== contentType) return true
        if (!quality.lang) return true
        const bestScore = bestRelevanceForPeriod(array)
        return languageRelatedness(preferredLanguage, quality.lang) >= bestScore
    }
}
