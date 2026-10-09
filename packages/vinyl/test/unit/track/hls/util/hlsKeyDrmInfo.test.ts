/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    defaultDrmKeySystemResolver,
    DrmKeySystem,
    hlsKeyDrmInfo,
} from '@amazon/vinyl'
import type { EncryptionKey } from '@amazon/vinyl-hls-parser'
import objectContaining = jasmine.objectContaining

describe('hlsKeyDrmInfo', () => {
    const deps = { drmKeySystemResolver: defaultDrmKeySystemResolver }

    const fairPlayKey: EncryptionKey = {
        method: 'SAMPLE-AES',
        uri: 'skd://0b5689bb-4171-97e5-c280-99f7abe4004f',
        keyFormat: 'com.apple.streamingkeydelivery',
        keyFormatVersions: '1',
    }

    it('returns null without a key', () => {
        expect(hlsKeyDrmInfo(deps, undefined)).toBeNull()
        expect(hlsKeyDrmInfo(deps, null)).toBeNull()
    })

    for (const method of ['NONE', 'AES-128'] as const) {
        it(`returns null for METHOD=${method}`, () => {
            expect(hlsKeyDrmInfo(deps, { ...fairPlayKey, method })).toBeNull()
        })
    }

    it('returns null for a key format that is not a DRM system', () => {
        expect(
            hlsKeyDrmInfo(deps, { ...fairPlayKey, keyFormat: 'identity' })
        ).toBeNull()
        const { keyFormat: _, ...withoutKeyFormat } = fairPlayKey
        expect(hlsKeyDrmInfo(deps, withoutKeyFormat)).toBeNull()
    })

    describe('for FairPlay', () => {
        it('uses the skd asset id as cbcs skd init data', () => {
            expect(hlsKeyDrmInfo(deps, fairPlayKey)).toEqual({
                contentProtections: [
                    {
                        keySystem: DrmKeySystem.FAIR_PLAY,
                        pssh: btoa('0b5689bb-4171-97e5-c280-99f7abe4004f'),
                    },
                ],
                encryptionScheme: 'cbcs',
                initDataType: 'skd',
            })
        })

        it('excludes the WebKit-prefixed FairPlay 1.0 key system', () => {
            const info = hlsKeyDrmInfo(deps, fairPlayKey)
            expect(
                info!.contentProtections.map((cP) => cP.keySystem)
            ).not.toContain(DrmKeySystem.FAIR_PLAY_1_0)
        })

        it('matches the key format case-insensitively', () => {
            expect(
                hlsKeyDrmInfo(deps, {
                    ...fairPlayKey,
                    keyFormat: 'COM.APPLE.STREAMINGKEYDELIVERY',
                })?.contentProtections
            ).toEqual([objectContaining({ keySystem: DrmKeySystem.FAIR_PLAY })])
        })

        it('omits init data when the key has no uri', () => {
            const { uri: _, ...withoutUri } = fairPlayKey
            expect(hlsKeyDrmInfo(deps, withoutUri)?.contentProtections).toEqual(
                [{ keySystem: DrmKeySystem.FAIR_PLAY }]
            )
        })
    })

    it('maps PlayReady to cenc PlayReady key systems', () => {
        const info = hlsKeyDrmInfo(deps, {
            method: 'SAMPLE-AES-CTR',
            uri: 'data:text/plain;base64,AAAA',
            keyFormat: 'com.microsoft.playready',
        })
        expect(info).toEqual({
            contentProtections: defaultDrmKeySystemResolver(
                'urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95'
            ).map((keySystem) => ({ keySystem })),
            encryptionScheme: 'cenc',
            initDataType: 'cenc',
        })
        expect(info!.contentProtections.length).toBeGreaterThan(0)
    })

    it('resolves a urn:uuid key format as a DRM system id', () => {
        expect(
            hlsKeyDrmInfo(deps, {
                method: 'SAMPLE-AES',
                uri: 'data:text/plain;base64,AAAA',
                keyFormat: 'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed',
            })
        ).toEqual({
            contentProtections: [{ keySystem: DrmKeySystem.WIDEVINE }],
            encryptionScheme: 'cbcs',
            initDataType: 'cenc',
        })
    })

    it('returns null when no key system matches', () => {
        expect(
            hlsKeyDrmInfo({ drmKeySystemResolver: () => [] }, fairPlayKey)
        ).toBeNull()
    })
})
