/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AnyRecord, Clearable, EventHost } from '@amazon/vinyl-util'

/**
 * Event map for LoudnessNormalizationController.
 */
export interface LoudnessNormalizationControllerEventMap {
    readonly change: AnyRecord
}

/**
 * Handles loudness normalization by applying gain adjustments
 * based on track loudness metadata.
 */
export interface LoudnessNormalizationController
    extends EventHost<LoudnessNormalizationControllerEventMap>, Clearable {
    /**
     * Loudness gain adjustment value.
     */
    readonly gain: number

    /**
     * Sets the current track's loudness level in LUFS, for the current track
     * played.
     *
     * @param value
     */
    setTrackLoudness(value: number | null): void
}
