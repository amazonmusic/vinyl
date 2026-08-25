/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { languageRelatedness } from '../track/filters/languageFilter'
import type { TextTrackInfo } from './TextTrack'

/**
 * Resolves the preferred-text-language option to an ordered list of BCP 47
 * tags, most-preferred first. Unlike the audio equivalent, `null` resolves to
 * an empty list (no preference) rather than falling back to
 * `navigator.languages` — captions default to off.
 */
function resolvePreferredTextLanguages(
    preferred: string | readonly string[] | null
): readonly string[] {
    if (typeof preferred === 'string') return [preferred]
    if (preferred) return preferred
    return []
}

/**
 * Chooses the text track that best matches the preferred language(s), or null
 * when none relate (or there is no preference / no tracks).
 *
 * Language dominates: a track is ranked first by which preference it relates to
 * (earlier entries win) and how closely (see {@link languageRelatedness}).
 * Within a single language, a full track is preferred over a forced-only track
 * (a user asking for a caption language wants the full captions, not just the
 * forced foreign-dialogue cues), and a manifest-default track breaks any
 * remaining tie.
 */
export function pickPreferredTextTrack(
    tracks: readonly TextTrackInfo[],
    preferred: string | readonly string[] | null
): TextTrackInfo | null {
    const prefs = resolvePreferredTextLanguages(preferred)
    if (tracks.length === 0 || prefs.length === 0) return null

    let best: TextTrackInfo | null = null
    let bestScore = 0
    for (const track of tracks) {
        const score = scoreTextTrack(track, prefs)
        if (score > bestScore) {
            bestScore = score
            best = track
        }
    }
    return best
}

/**
 * Scores a track against the ordered preference list. 0 means unrelated to
 * every preference (never selected). Preference position and language
 * relatedness are weighted so they dominate the full/forced/default tiebreaks.
 */
function scoreTextTrack(
    track: TextTrackInfo,
    prefs: readonly string[]
): number {
    if (track.language == null) return 0
    let best = 0
    for (let i = 0; i < prefs.length; i++) {
        const rel = languageRelatedness(prefs[i], track.language)
        if (rel > 0) {
            best = Math.max(best, (prefs.length - i) * 100 + rel * 10)
        }
    }
    if (best === 0) return 0
    // Tiebreaks within the same language: prefer full over forced, then default.
    if (!track.forced) best += 2
    if (track.default) best += 1
    return best
}
