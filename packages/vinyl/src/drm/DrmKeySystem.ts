/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ValueSchema } from '@amazon/vinyl-validation'
import { string } from '@amazon/vinyl-validation'

export enum DrmKeySystem {
    /**
     * Plain text encryption.
     */
    CLEAR_KEY = 'org.w3.clearkey',

    /**
     * Google's Widevine.
     */
    WIDEVINE = 'com.widevine.alpha',

    /**
     * Microsoft's PlayReady.
     *
     * - Deprecated.
     * - Will be removed in a future release.
     * - Non-compliant with any version of the EME specification.
     */
    PLAY_READY = 'com.microsoft.playready',

    /**
     * Microsoft's PlayReady for Chromecast.
     *
     * - Deprecated.
     * - Will be removed in a future release.
     * - Non-compliant with any version of the EME specification.
     */
    PLAY_READY_CHROMECAST = 'com.chromecast.playready',

    /**
     * Microsoft's PlayReady.
     *
     * - Security Level 2000.
     * - Best effort compliance with latest EME specification.
     */
    PLAY_READY_RECOMMENDATION = 'com.microsoft.playready.recommendation',

    /**
     * Microsoft's PlayReady.
     *
     * - Supported on devices with required hardware.
     * - Security Level 3000.
     * - Best effort compliance with latest EME specification.
     */
    PLAY_READY_3000 = 'com.microsoft.playready.recommendation.3000',

    /**
     * Apple's Fairplay for modern EME.
     */
    FAIR_PLAY = 'com.apple.fps',

    /**
     * Apple's Fairplay for legacy Apple Media Keys.
     */
    FAIR_PLAY_1_0 = 'com.apple.fps.1_0',
}

/**
 * Validates that the key system value is a string.
 * While DrmKeySystem is an enum to be useful for providing known key systems,
 * avoid strict validation to allow for unknown key systems.
 */
export const drmKeySystemValidator =
    string().notEmpty() as ValueSchema<DrmKeySystem>

export const PLAY_READY_KEY_SYSTEMS: readonly DrmKeySystem[] = [
    DrmKeySystem.PLAY_READY,
    DrmKeySystem.PLAY_READY_CHROMECAST,
    DrmKeySystem.PLAY_READY_RECOMMENDATION,
    DrmKeySystem.PLAY_READY_3000,
] as const

export function isPlayReady(keySystem: DrmKeySystem): boolean {
    return PLAY_READY_KEY_SYSTEMS.includes(keySystem)
}

export const FAIR_PLAY_KEY_SYSTEMS: readonly DrmKeySystem[] = [
    DrmKeySystem.FAIR_PLAY,
    DrmKeySystem.FAIR_PLAY_1_0,
] as const

export function isFairPlay(keySystem: DrmKeySystem): boolean {
    return FAIR_PLAY_KEY_SYSTEMS.includes(keySystem)
}
