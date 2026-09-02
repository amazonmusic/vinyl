/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ObjectSchema } from '@amazon/vinyl-validation'
import {
    array,
    boolean,
    number,
    object,
    string,
} from '@amazon/vinyl-validation'
import type { Maybe } from '@amazon/vinyl-util'

/**
 * Criteria used to pick which audio rendition to play.
 */
export interface AudioSelection {
    /**
     * Preferred language(s) for audio content, as RFC 5646 codes (e.g. `'en'`,
     * `'ja'`, `'fr-CA'`). May be a single tag or an ordered list of tags —
     * earlier entries are preferred, with the best relatedness match kept for
     * each period (audio without a language tag is always kept). `null` (the
     * default) is NOT "no preference": it orders by the platform's
     * `navigator.languages`. To keep every language, this option is not the
     * mechanism — omit language content or pass a tag matching all.
     */
    readonly language?: string | readonly string[] | null

    /**
     * Opt in to audio-description (a.k.a. described-video / DVS) audio: audio
     * renditions carrying an accessibility "describes video" characteristic that
     * narrate on-screen action. `false` (the default) keeps them out of the
     * automatic default-audio selection — they are chosen only when this is set.
     * When `true`, a description rendition is preferred where one exists for the
     * selected language. Changing this reselects audio immediately.
     */
    readonly descriptive?: boolean
}

/**
 * Declarative audio configuration. Mirrors `VinylOptions.text`: the audio
 * rendition is chosen from {@link selection}; changing it reselects audio
 * immediately.
 */
export interface AudioOptions {
    /**
     * The audio selection criteria (language / descriptive).
     */
    readonly selection?: AudioSelection

    /**
     * When `true`, disables the audio sampling-rate support filter, so audio
     * renditions whose sampling rate exceeds what the platform reports (via the
     * `AudioContext` output rate) are kept and offered to playback anyway.
     * `false` (the default) applies the filter. Changing this re-filters the
     * timeline immediately.
     */
    readonly disableSampleRateFilter?: boolean

    /**
     * The maximum audio sampling rate (Hz) the sampling-rate filter treats as
     * supported. When set, it takes precedence over the platform's
     * `AudioContext`-reported output rate. Ignored when
     * {@link disableSampleRateFilter} is `true`. Changing this re-filters the
     * timeline immediately. `null`/`undefined` falls back to the reported rate.
     */
    readonly maxSampleRate?: Maybe<number>
}

export const defaultAudioOptions: AudioOptions = {
    selection: { language: null, descriptive: false },
    disableSampleRateFilter: false,
}

const audioSelectionValidator: ObjectSchema<AudioSelection> = object({
    language: string().or(array(string()).readonly()).orNull().optional(),
    descriptive: boolean().optional(),
})

export const audioOptionsValidator: ObjectSchema<AudioOptions> = object({
    selection: audioSelectionValidator.optional(),
    disableSampleRateFilter: boolean().optional(),
    maxSampleRate: number().maybe().optional(),
})
