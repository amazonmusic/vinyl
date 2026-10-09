/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EncryptionKey } from '@amazon/vinyl-hls-parser'
import { ContentProtectionScheme } from '@amazon/vinyl-mpd-parser'
import {
    bufferToBase64,
    byteStrToByteArray,
    type Maybe,
} from '@amazon/vinyl-util'
import type { CencEncryptionScheme } from '../../../drm/CencEncryptionScheme'
import { DrmKeySystem } from '../../../drm/DrmKeySystem'
import type { DrmKeySystemResolver } from '../../../drm/DrmKeySystemResolver'
import type { DrmInitDataType } from '../../../streaming/DrmInitDataType'
import type { MediaFormatMetadata } from '../../../streaming/MediaQualityMetadata'

/**
 * The DRM fields of {@link MediaFormatMetadata} derived from an HLS key.
 */
export type HlsKeyDrmInfo = Pick<
    MediaFormatMetadata,
    'contentProtections' | 'encryptionScheme' | 'initDataType'
>

export interface HlsKeyDrmInfoDeps {
    readonly drmKeySystemResolver: DrmKeySystemResolver
}

/** KEYFORMAT for Apple FairPlay Streaming. */
const FAIR_PLAY_KEY_FORMAT = 'com.apple.streamingkeydelivery'

/** KEYFORMAT for Microsoft PlayReady. */
const PLAY_READY_KEY_FORMAT = 'com.microsoft.playready'

/**
 * Derives the DRM metadata for fMP4 segments encrypted with the given
 * EXT-X-KEY, or null if the key does not describe EME-decryptable content.
 *
 * SAMPLE-AES is `cbcs` and SAMPLE-AES-CTR is `cenc` common encryption. The
 * KEYFORMAT identifies the DRM system: FairPlay, PlayReady, or a `urn:uuid:`
 * DRM system id (e.g. Widevine), resolved to key systems the same way as a
 * DASH ContentProtection scheme. METHOD=NONE, whole-segment AES-128, and
 * `identity` (clear key URI) keys are not EME-decryptable and return null.
 *
 * FairPlay sessions are created from the key's `skd://` asset id (init data
 * type `skd`), supplied as manifest init data so in-band `encrypted` events
 * are ignored. Those report the init segment's `sinf` box instead, from which
 * the CDM puts the binary key id in the SPC, where license servers expect the
 * asset id. The legacy {@link DrmKeySystem.FAIR_PLAY_1_0} key system
 * is excluded: it only decrypts natively played HLS, not MSE.
 */
export function hlsKeyDrmInfo(
    deps: HlsKeyDrmInfoDeps,
    key: Maybe<EncryptionKey>
): HlsKeyDrmInfo | null {
    const encryptionScheme = methodToEncryptionScheme(key?.method)
    if (key == null || encryptionScheme == null) return null
    const keyFormat = key.keyFormat?.toLowerCase()
    let schemeIdUri: string
    let initDataType: DrmInitDataType
    let initData: string | null = null
    if (keyFormat === FAIR_PLAY_KEY_FORMAT) {
        schemeIdUri = ContentProtectionScheme.FAIR_PLAY
        initDataType = 'skd'
        initData = key.uri ? fairPlayInitData(key.uri) : null
    } else if (keyFormat === PLAY_READY_KEY_FORMAT) {
        schemeIdUri = ContentProtectionScheme.PLAY_READY
        initDataType = 'cenc'
    } else if (keyFormat?.startsWith('urn:uuid:')) {
        schemeIdUri = keyFormat
        initDataType = 'cenc'
    } else {
        return null
    }
    const keySystems = deps
        .drmKeySystemResolver(schemeIdUri)
        .filter((keySystem) => keySystem !== DrmKeySystem.FAIR_PLAY_1_0)
    if (keySystems.length === 0) return null
    return {
        contentProtections: keySystems.map((keySystem) => ({
            keySystem,
            ...(initData != null && { pssh: initData }),
        })),
        encryptionScheme,
        initDataType,
    }
}

/**
 * The `skd` init data for a FairPlay key URI: its asset id (the URI without the
 * `skd://` scheme), which the CDM places in the SPC for the license server to
 * look up the key by.
 */
function fairPlayInitData(uri: string): string {
    return bufferToBase64(byteStrToByteArray(uri.replace(/^skd:\/\//i, '')))
}

function methodToEncryptionScheme(
    method: Maybe<EncryptionKey['method']>
): CencEncryptionScheme | null {
    switch (method) {
        case 'SAMPLE-AES':
            return 'cbcs'
        case 'SAMPLE-AES-CTR':
            return 'cenc'
        default:
            return null
    }
}
