/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { DrmKeySystem } from '@amazon/vinyl'
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
