/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    defaultQualitySelectorImplOptions,
    type QualitySelectorImplOptions,
    qualitySelectorImplOptionsValidator,
} from '@/streaming/abr/QualitySelectorImpl'
import type { ObjectSchema } from '@amazon/vinyl-validation'
import { object, string } from '@amazon/vinyl-validation'
import {
    defaultLoudnessNormalizationControllerImplOptions,
    type LoudnessNormalizationControllerImplOptions,
    loudnessNormalizationControllerImplOptionsValidator,
} from '@/playback/loudness/LoudnessNormalizationControllerImplOptions'

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
}

export const defaultVinylOptions: VinylOptions = {
    abr: defaultQualitySelectorImplOptions,
    loudnessNormalization: defaultLoudnessNormalizationControllerImplOptions,
    preferredAudioLanguage: null,
}

export const vinylOptionsValidator: ObjectSchema<VinylOptions> = object({
    abr: qualitySelectorImplOptionsValidator,
    loudnessNormalization: loudnessNormalizationControllerImplOptionsValidator,
    preferredAudioLanguage: string().orNull(),
})
