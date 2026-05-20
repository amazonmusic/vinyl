/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ObjectSchema } from '@amazon/vinyl-validation'
import { boolean, number, object } from '@amazon/vinyl-validation'

/**
 * Options for configuring the loudness normalization controller.
 */
export interface LoudnessNormalizationControllerImplOptions {
    /**
     * If true, applies loudness Normalization to the current track played.
     * Default: false
     */
    readonly enabled: boolean

    /**
     * Target loudness level in LUFS (Loudness Units relative to Full Scale).
     * Default: -14.0 dB
     */
    readonly targetLufs?: number

    /**
     * Maximum gain reduction to apply in dB.
     * Default: 10 Db
     */
    readonly maxGainDb?: number
}

export const defaultLoudnessNormalizationControllerImplOptions = {
    enabled: false,
    targetLufs: -14.0,
    maxGainDb: 10.0,
} as const satisfies LoudnessNormalizationControllerImplOptions

export const loudnessNormalizationControllerImplOptionsValidator: ObjectSchema<LoudnessNormalizationControllerImplOptions> =
    object({
        enabled: boolean(),
        targetLufs: number().optional(),
        maxGainDb: number().optional(),
    })
