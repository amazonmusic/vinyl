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
    boolean,
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
import { type VttCueStyle, vttCueStyleValidator } from '../text/VttCueStyle'

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
     * Preferred language(s) for text tracks (subtitles / closed captions), as
     * RFC 5646 codes (e.g. `'en'`, `'ja'`, `'fr-CA'`). May be a single tag or
     * an ordered list of tags — earlier entries are preferred, with the best
     * relatedness match chosen among the discovered text tracks. When set, the
     * matching text track is selected automatically and the choice carries
     * across track changes (e.g. across an ad break), mirroring how
     * {@link preferredAudioLanguage} drives audio selection.
     *
     * Unlike audio, `null` (the default) means *no caption preference*: it does
     * NOT fall back to `navigator.languages` and does NOT force captions on —
     * forced narrative subtitles still auto-display as usual. Setting it to a
     * language turns captions on in that language; setting it back to `null`
     * after a prior selection turns captions off.
     */
    readonly preferredTextLanguage: string | readonly string[] | null

    /**
     * Opt in to audio-description (a.k.a. described-video / DVS) audio: audio
     * renditions carrying an accessibility "describes video" characteristic that
     * narrate on-screen action. `false` (the default) keeps them out of the
     * automatic default-audio selection — they are chosen only when this is set.
     * When `true`, a description rendition is preferred where one exists for the
     * selected language. Changing this reselects audio immediately.
     */
    readonly preferDescriptiveAudio: boolean

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
     * Layout style applied to rendered WebVTT cues (the settable `VTTCue`
     * positioning properties: size, line, position, align, etc.). Applied to
     * each cue as it is added, on platforms that support `VTTCue`.
     *
     * Defaults to `{ size: 90 }`, insetting the cue box from the full video
     * width so long lines don't clip at the screen edges in fullscreen (which
     * `::cue` CSS cannot fix). Set to `null` to keep the browser defaults.
     */
    readonly textCueStyle: VttCueStyle | null
}

export const defaultVinylOptions: VinylOptions = {
    abr: defaultQualitySelectorImplOptions,
    loudnessNormalization: defaultLoudnessNormalizationControllerImplOptions,
    preferredAudioLanguage: null,
    preferredTextLanguage: null,
    preferDescriptiveAudio: false,
    codecOverrides: {},
    allowedContentTypes: null,
    textCueStyle: { size: 90 },
}

export const vinylOptionsValidator: ObjectSchema<VinylOptions> = object({
    abr: qualitySelectorImplOptionsValidator,
    loudnessNormalization: loudnessNormalizationControllerImplOptionsValidator,
    preferredAudioLanguage: string().or(array(string()).readonly()).orNull(),
    preferredTextLanguage: string().or(array(string()).readonly()).orNull(),
    preferDescriptiveAudio: boolean(),
    codecOverrides: record(string(), isOneOf('allow', 'deny')),
    allowedContentTypes: array(isOneOf(...RESTRICTABLE_CONTENT_TYPES))
        .cast<readonly RestrictableContentType[]>()
        .describe(
            'Allow list of media content types (audio, video) to stream; other media streams are ignored. Text tracks are unaffected.'
        )
        .orNull(),
    textCueStyle: vttCueStyleValidator.orNull(),
})
