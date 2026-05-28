/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type DrmKeySystem } from '../drm/DrmKeySystem'
import type { Capabilities } from './Capabilities'
import { CanPlayTypeResult } from './Capabilities'
import { isTypeSupported, supportsMse } from '../util/media/mediaSource'
import { getAudioContext } from '../util/media/getAudioContext'
import type { DrmController, DrmKeySystemSupport } from '../drm/DrmController'

/**
 * Dependencies for CapabilitiesImpl.
 */
export interface CapabilitiesImplDeps {
    readonly media: HTMLMediaElement
    readonly drmController: DrmController
}

/**
 * Client support detection.
 */
export class CapabilitiesImpl implements Capabilities {
    constructor(private readonly deps: CapabilitiesImplDeps) {}

    get mse(): boolean {
        return supportsMse()
    }

    get dash(): boolean {
        return this.canPlayType('application/dash+xml') !== CanPlayTypeResult.NO
    }

    get hls(): boolean {
        return (
            this.canPlayType('application/vnd.apple.mpegurl') !==
            CanPlayTypeResult.NO
        )
    }

    get eme(): boolean {
        return this.deps.drmController.isEmeSupported()
    }

    get sampleRate(): number | null {
        return getAudioContext()?.sampleRate ?? null
    }

    canPlayType(type: string): CanPlayTypeResult {
        const media: HTMLMediaElement = this.deps.media
        if (typeof media.canPlayType === 'undefined')
            return CanPlayTypeResult.NO
        const str = media.canPlayType(type)
        switch (str) {
            case '':
                return CanPlayTypeResult.NO
            case 'maybe':
                return CanPlayTypeResult.MAYBE
            case 'probably':
                return CanPlayTypeResult.PROBABLY
        }
    }

    canPlayTypeMse(type: string): boolean {
        return isTypeSupported(type)
    }

    async supportsKeySystem(
        keySystem: DrmKeySystem
    ): Promise<DrmKeySystemSupport> {
        // Take the most commonly supported codec and media format, check the DrmController if
        // it is supported with the given key system.
        return this.deps.drmController.isSupported({
            initDataType: 'cenc',
            encryptionScheme: 'cenc',
            contentType: 'audio',
            mimeType: 'audio/mp4; codecs="mp4a.40.2"',
            contentProtections: [{ keySystem }],
        })
    }
}
