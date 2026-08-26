/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MediaQualityMetadata } from './MediaQualityMetadata'
import type { FilterPredicate } from '@amazon/vinyl-util'
import { MediaUnsupportedError, memoize } from '@amazon/vinyl-util'

/**
 * Thrown if the audio-description filter ever emptied a period's audio. The
 * filter keeps at least one audio rendition per period by design, so this is a
 * defensive guard rather than an expected path.
 */
export function throwNoPlayableAudio(): never {
    throw new MediaUnsupportedError('No playable audio rendition', 'audio')
}

/**
 * Characteristics that mark an audio rendition as an audio description (a.k.a.
 * described video / DVS) — narration of on-screen action for viewers who cannot
 * see it. HLS signals this with the `public.accessibility.describes-video`
 * CHARACTERISTIC; DASH with a `description` Role. Such renditions must not be
 * chosen as the default audio; they are an accessibility opt-in.
 */
export const AUDIO_DESCRIPTION_CHARACTERISTICS: readonly string[] = [
    'public.accessibility.describes-video',
    'description',
]

/**
 * Whether an audio quality is an audio-description rendition.
 */
export function isAudioDescription(quality: MediaQualityMetadata): boolean {
    return quality.characteristics.some((c) =>
        AUDIO_DESCRIPTION_CHARACTERISTICS.includes(c)
    )
}

/**
 * Creates a filter that keeps audio-description renditions out of (or, when
 * opted in, restricts audio to) the audio selection.
 *
 * - `preferDescription: false` (default): drop audio-description renditions
 *   from each period *when a non-description audio alternative exists*, so the
 *   main audio is chosen by default instead of the description track. If a
 *   period has only description audio, it is kept (playback is never stranded).
 * - `preferDescription: true`: keep only description renditions when the period
 *   has any; otherwise keep all (again, never strand playback).
 *
 * Non-audio qualities are always kept.
 */
export function createAudioDescriptionFilter(
    preferDescription: boolean
): FilterPredicate<MediaQualityMetadata> {
    // Per period (per unique array reference): does it have description audio,
    // and does it have non-description ("main") audio?
    const periodFlags = memoize(
        (array: ArrayLike<MediaQualityMetadata>) => {
            let hasDescription = false
            let hasMain = false
            for (const quality of Array.from(array)) {
                if (quality.contentType !== 'audio') continue
                if (isAudioDescription(quality)) hasDescription = true
                else hasMain = true
            }
            return { hasDescription, hasMain }
        },
        (array) => array,
        1
    )

    return (quality, _index, array) => {
        if (quality.contentType !== 'audio') return true
        const { hasDescription, hasMain } = periodFlags(array)
        if (preferDescription) {
            // Nothing to prefer; keep all rather than strand playback.
            if (!hasDescription) return true
            return isAudioDescription(quality)
        }
        // No main alternative; keep all rather than strand playback.
        if (!hasMain) return true
        return !isAudioDescription(quality)
    }
}
