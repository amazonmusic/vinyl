/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TextTrackKind } from './TextTrack'

/**
 * A handle to a DOM {@link TextTrack} created on the media element, plus a way
 * to clear its cues.
 */
export interface TextTrackRef {
    readonly track: TextTrack

    /**
     * Removes all cues from the track. Must be called while the track is not
     * `disabled` — `TextTrack.cues` reads null in the disabled state, so
     * clearing a disabled track silently leaves its cues attached.
     */
    clear(): void
}

/**
 * Creates and hands out DOM text tracks for a media element, memoized per
 * `(kind, label, language)`.
 *
 * `HTMLMediaElement.addTextTrack` tracks can never be removed, so creating a
 * fresh one per activation would accumulate tracks — and any left in `showing`
 * mode renders alongside the active one (captions "bleed through"). Reusing one
 * track per key keeps exactly one track per distinct rendition.
 */
export interface MediaTextTrackProvider {
    getOrCreate(
        kind: TextTrackKind,
        label?: string,
        language?: string
    ): TextTrackRef
}

export function createMediaTextTrackProvider(deps: {
    /**
     * The HTML media element on which to attach the in-band TextTrack
     * representation.
     */
    readonly media: HTMLMediaElement
}): MediaTextTrackProvider {
    const { media } = deps
    const cache = new Map<string, TextTrackRef>()

    const isAttached = (track: TextTrack): boolean => {
        for (let i = 0; i < media.textTracks.length; i++) {
            if (media.textTracks[i] === track) return true
        }
        return false
    }

    const create = (
        kind: TextTrackKind,
        label?: string,
        language?: string
    ): TextTrackRef => {
        const track = media.addTextTrack(kind, label, language)
        return {
            track,
            clear() {
                if (!track.cues) return
                // Snapshot first — removeCue mutates the live list.
                const all = Array.from(track.cues)
                for (const cue of all) track.removeCue(cue)
            },
        }
    }

    return {
        getOrCreate(kind, label, language) {
            const key = `${kind}-${label}-${language}`
            const cached = cache.get(key)
            // Resetting the media source (MSE `src = null; load()`) drops added
            // tracks, so a cached track can become detached; recreate when so.
            if (cached && isAttached(cached.track)) return cached
            const ref = create(kind, label, language)
            cache.set(key, ref)
            return ref
        },
    }
}
