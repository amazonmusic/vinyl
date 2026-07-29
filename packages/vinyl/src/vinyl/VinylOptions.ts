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
import { isOneOf, object, record, string } from '@amazon/vinyl-validation'
import type { CodecOverrides } from '../util/media/codecOverrides'
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
     * Preferred language for audio content, using a code as defined by RFC 5646 (e.g. 'en', 'ja').
     * When set, only adaptation sets / variants matching this language (or without a language tag)
     * are kept. Null means no language preference (all languages are kept).
     */
    readonly preferredAudioLanguage: string | null

    /**
     * Explicit codec allow/deny overrides that bypass browser support
     * detection. Keys are RFC 6381 codec strings or prefixes (e.g. `"hvc1"`),
     * values are `'allow'` or `'deny'`. An `'allow'` forces a codec to be
     * treated as supported; a `'deny'` forces it to be treated as unsupported.
     * Empty by default (support is determined solely by the browser and the
     * known-false-report list).
     */
    readonly codecOverrides: CodecOverrides
}

export const defaultVinylOptions: VinylOptions = {
    abr: defaultQualitySelectorImplOptions,
    loudnessNormalization: defaultLoudnessNormalizationControllerImplOptions,
    preferredAudioLanguage: null,
    codecOverrides: {},
}

export const vinylOptionsValidator: ObjectSchema<VinylOptions> = object({
    abr: qualitySelectorImplOptionsValidator,
    loudnessNormalization: loudnessNormalizationControllerImplOptionsValidator,
    preferredAudioLanguage: string().orNull(),
    codecOverrides: record(string(), isOneOf('allow', 'deny')),
})
