/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DrmKeySystem } from '@/drm/DrmKeySystem'
import type { DrmKeySystemSupport } from '@/drm/DrmController'

export enum CanPlayTypeResult {
    /**
     * The media cannot be played on the current device.
     */
    NO = 'no',

    /**
     * There is not enough information to determine whether the media can play.
     */
    MAYBE = 'maybe',

    /**
     * The media is probably playable on this device.
     */
    PROBABLY = 'probably',
}

/**
 * Detected capabilities of the device.
 */
export interface Capabilities {
    /**
     * Returns true if Media Source Extensions are supported.
     *
     * Note that this does not test DRM or any DRM key systems.
     */
    readonly mse: boolean

    /**
     * Returns true if Encrypted Media Extensions are supported.
     */
    readonly eme: boolean

    /**
     * Returns true if native Dynamic Adaptive Streaming is supported.
     *
     * (Legacy Edge 12-18 and XBox One)
     * Note that this is not the same as supporting a dash track.
     */
    readonly dash: boolean

    /**
     * Returns true if native HTTP Live Streaming is supported.
     *
     * iOS 7.0+, Safari 8.0+
     * Note that this does not do FairPlay detection.
     */
    readonly hls: boolean

    /**
     * Returns the sample rate, in samples per second, that this platform supports.
     * Returns null if the sample rate cannot be determined.
     */
    readonly sampleRate: number | null

    /**
     * Returns a string that specifies whether the client can play a given media resource type for progressive
     * content.
     *
     * @param type A string specifying the MIME type of the media and (optionally) a codecs
     * parameter containing a comma-separated list of the supported codecs.
     */
    canPlayType(type: string): CanPlayTypeResult

    /**
     * Returns a boolean that specifies whether the client can play a given media resource type for streaming
     * content with media source extensions.
     *
     * @param type A string specifying the MIME type of the media and (optionally) a codecs
     * parameter containing a comma-separated list of the supported codecs.
     */
    canPlayTypeMse(type: string): boolean

    /**
     * Returns a promise describing support for the given key system.
     *
     * @param keySystem
     */
    supportsKeySystem(keySystem: DrmKeySystem): Promise<DrmKeySystemSupport>
}
