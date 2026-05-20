/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createVinylSuite,
    expectPlaylistPlays,
    vinylTestAssets,
} from '@amazon/vinyl/vinylTestUtil'
import { supportsMse, type VinylTrackLoadOptions } from '@amazon/vinyl'

describe('dash with segmentBase integ', () => {
    const playlist = [
        {
            type: 'dash',
            uri: vinylTestAssets.dash.live_static_aac_opus_flac_60s_segmentBase,
        },
    ] as VinylTrackLoadOptions[]
    const suite = createVinylSuite()

    beforeEach(() => {
        if (!supportsMse()) pending('MSE not supported')
    })

    it('plays', async () => {
        await expectPlaylistPlays(suite.player, playlist)
    })
})
