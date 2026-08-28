/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    defaultQualitySelectorImplOptions,
    type QualitySelectorImplOptions,
    qualitySelectorImplOptionsValidator,
} from '../streaming/abr/QualitySelectorImpl'
import type { ObjectSchema } from '@amazon/vinyl-validation'
import {
    array,
    isOneOf,
    object,
    record,
    string,
} from '@amazon/vinyl-validation'
import type { CodecOverrides } from '../util/media/codecOverrides'
import {
    RESTRICTABLE_CONTENT_TYPES,
    type RestrictableContentType,
} from '../streaming/MediaQualityMetadata'
import {
    defaultLoudnessNormalizationControllerImplOptions,
    type LoudnessNormalizationControllerImplOptions,
    loudnessNormalizationControllerImplOptionsValidator,
} from '../playback/loudness/LoudnessNormalizationControllerImplOptions'
import {
    type TextTrackControllerOptions,
    textTrackControllerOptionsValidator,
} from '../text/TextTrack'
import {
    type AudioOptions,
    audioOptionsValidator,
    defaultAudioOptions,
} from '../streaming/AudioOptions'

export interface VinylOptions {
    /**
     * Configuration for the default adaptive bitrate selector.
     */
    readonly abr: QualitySelectorImplOptions

    readonly loudnessNormalization: LoudnessNormalizationControllerImplOptions

    /**
     * Audio (language / audio-description) configuration. See
     * {@link AudioOptions}.
     *
     * The default is `{ selection: { language: null, descriptive: false } }`:
     * audio is ordered by the platform's `navigator.languages` and
     * audio-description renditions are excluded. Set `selection.language` to
     * prefer specific language(s) and `selection.descriptive` to `true` to opt
     * into described audio.
     */
    readonly audio: AudioOptions

    /**
     * Explicit codec allow/deny overrides that bypass browser support
     * detection. Keys are RFC 6381 codec strings or prefixes (e.g. `"hvc1"`),
     * values are `'allow'` or `'deny'`. An `'allow'` forces a codec to be
     * treated as supported; a `'deny'` forces it to be treated as unsupported.
     * Empty by default (support is determined solely by the browser and the
     * known-false-report list).
     */
    readonly codecOverrides: CodecOverrides

    /**
     * Allow list restricting which media content types (`'audio'`, `'video'`)
     * are streamed. When set, only streams whose content type is in the list
     * are created; all other media streams are ignored. For example,
     * `['audio']` streams audio but never video. Changing this reloads the
     * track using only the allowed content types. Null (the default) means no
     * restriction (all available media content types are streamed).
     *
     * Text tracks (subtitles / closed captions) are not affected by this allow
     * list; they are governed by caption selection and always remain
     * available.
     */
    readonly allowedContentTypes: readonly RestrictableContentType[] | null

    /**
     * Text-track (subtitles / closed captions) configuration: enable/disable
     * and the selection criteria. See {@link TextTrackControllerOptions}.
     *
     * The default is `{ enabled: 'forced' }`: with no
     * explicit language, the platform's `navigator.languages` are preferred,
     * showing only forced (narrative) tracks. Set `enabled` to `'on'` for full
     * subtitle tracks or `'off'` to render nothing;
     * `selection.language`/`selection.id` choose a specific rendition.
     */
    readonly text: TextTrackControllerOptions
}

export const defaultVinylOptions: VinylOptions = {
    abr: defaultQualitySelectorImplOptions,
    loudnessNormalization: defaultLoudnessNormalizationControllerImplOptions,
    audio: defaultAudioOptions,
    codecOverrides: {},
    allowedContentTypes: null,
    text: {
        // Forced-only captions in the platform's preferred languages (no
        // explicit language → navigator.languages).
        enabled: 'forced',
    },
}

export const vinylOptionsValidator: ObjectSchema<VinylOptions> = object({
    abr: qualitySelectorImplOptionsValidator,
    loudnessNormalization: loudnessNormalizationControllerImplOptionsValidator,
    audio: audioOptionsValidator,
    codecOverrides: record(string(), isOneOf('allow', 'deny')),
    allowedContentTypes: array(isOneOf(...RESTRICTABLE_CONTENT_TYPES))
        .readonly()
        .describe(
            'Allow list of media content types (audio, video) to stream; other media streams are ignored. Text tracks are unaffected.'
        )
        .orNull(),
    text: textTrackControllerOptionsValidator,
})
