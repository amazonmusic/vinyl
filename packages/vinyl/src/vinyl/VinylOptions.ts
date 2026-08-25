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

export interface VinylOptions {
    /**
     * Configuration for the default adaptive bitrate selector.
     */
    readonly abr: QualitySelectorImplOptions

    readonly loudnessNormalization: LoudnessNormalizationControllerImplOptions

    /**
     * Preferred language(s) for audio content, as RFC 5646 codes (e.g. `'en'`,
     * `'ja'`, `'fr-CA'`). May be a single tag or an ordered list of tags —
     * earlier entries are preferred, with the best relatedness match kept for
     * each period (audio without a language tag is always kept). `null` (the
     * default) is NOT "no preference": it orders by the platform's
     * `navigator.languages`. To keep every language, this option is not the
     * mechanism — omit language content or pass a tag matching all.
     */
    readonly preferredAudioLanguage: string | readonly string[] | null

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
}

export const defaultVinylOptions: VinylOptions = {
    abr: defaultQualitySelectorImplOptions,
    loudnessNormalization: defaultLoudnessNormalizationControllerImplOptions,
    preferredAudioLanguage: null,
    codecOverrides: {},
    allowedContentTypes: null,
}

export const vinylOptionsValidator: ObjectSchema<VinylOptions> = object({
    abr: qualitySelectorImplOptionsValidator,
    loudnessNormalization: loudnessNormalizationControllerImplOptionsValidator,
    preferredAudioLanguage: string().or(array(string()).readonly()).orNull(),
    codecOverrides: record(string(), isOneOf('allow', 'deny')),
    allowedContentTypes: array(isOneOf(...RESTRICTABLE_CONTENT_TYPES))
        .cast<readonly RestrictableContentType[]>()
        .describe(
            'Allow list of media content types (audio, video) to stream; other media streams are ignored. Text tracks are unaffected.'
        )
        .orNull(),
})
