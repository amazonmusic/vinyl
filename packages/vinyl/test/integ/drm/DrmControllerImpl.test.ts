/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { DrmKeySystem, type DrmKeyStatusesChangeEvent } from '@amazon/vinyl'
import {
    createVinylSuite,
    expectTrackPlays,
    vinylTestAssets,
} from '@amazon/vinyl/vinylTestUtil'
import { pendingIfWidevineNotSupported } from './pendingIfWidevineNotSupported'

describe('DrmControllerImpl integ', () => {
    const vinylSuite = createVinylSuite({
        drm: {
            keySystems: {
                [DrmKeySystem.WIDEVINE]: {
                    licenseServer: {
                        url: 'https://cwip-shaka-proxy.appspot.com/no_auth',
                    },
                },
            },
        },
    })

    beforeEach(async () => {
        await pendingIfWidevineNotSupported(vinylSuite.player)
    })

    describe('when given dash widevine', () => {
        it('emits a usable keyStatusesChange on the player', async () => {
            const keyStatusesChange = new Promise<DrmKeyStatusesChangeEvent>(
                (resolve) =>
                    vinylSuite.player.on('keyStatusesChange', (event) => {
                        if (
                            event.keyStatuses.some(
                                ({ status }) => status === 'usable'
                            )
                        )
                            resolve(event)
                    })
            )
            vinylSuite.player.load({
                type: 'dash',
                uri: vinylTestAssets.dash
                    .live_static_aac_opus_flac_60s_segmentBase_widevine,
            })
            await vinylSuite.player.play()
            const event = await keyStatusesChange
            expect(event.keySystem).toBe(DrmKeySystem.WIDEVINE)
            expect(event.keyStatuses[0]?.keyId.byteLength).toBe(16)
        })

        it('plays', async () => {
            vinylSuite.player.load({
                type: 'dash',
                uri: vinylTestAssets.dash
                    .live_static_aac_opus_flac_60s_segmentBase_widevine,
            })
            await vinylSuite.player.play()
            await expectTrackPlays(vinylSuite.player)
        })
    })
})

describe('DrmControllerImpl integ when preferPrefixedMediaKeys is true', () => {
    const prefixedSuite = createVinylSuite({
        drm: {
            keySystems: {
                [DrmKeySystem.WIDEVINE]: {
                    licenseServer: {
                        url: 'https://cwip-shaka-proxy.appspot.com/no_auth',
                    },
                },
            },
            preferPrefixedMediaKeys: true,
        },
    })

    beforeEach(async () => {
        await pendingIfWidevineNotSupported(prefixedSuite.player)
    })

    // Widevine is only available through standard EME, so preferring
    // prefixed EME must still fall back to it and play.
    it('plays dash widevine', async () => {
        prefixedSuite.player.load({
            type: 'dash',
            uri: vinylTestAssets.dash
                .live_static_aac_opus_flac_60s_segmentBase_widevine,
        })
        await prefixedSuite.player.play()
        await expectTrackPlays(prefixedSuite.player)
    })
})
