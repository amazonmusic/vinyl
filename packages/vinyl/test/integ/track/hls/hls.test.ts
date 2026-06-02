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

describe('hls integ', () => {
    const playlist: VinylTrackLoadOptions[] = [
        {
            type: 'hls',
            uri: vinylTestAssets.hls.live_static_video_60s_2s_mpegts,
        },
        {
            type: 'hls',
            uri: vinylTestAssets.hls.live_static_video_audio_60s_4s_mpegts,
        },
        {
            type: 'hls',
            uri: vinylTestAssets.hls.live_static_aac_60s_mpegts,
        },
        {
            type: 'hls',
            uri: vinylTestAssets.hls.live_static_aac_opus_flac_60s,
        },
    ]
    const suite = createVinylSuite(
        {},
        {
            timeout: 180,
        }
    )

    beforeEach(() => {
        if (!supportsMse()) pending('MSE not supported')
    })

    it('plays', async () => {
        await expectPlaylistPlays(suite.player, playlist)
    })
})
