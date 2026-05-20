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

describe('dash video with segmentTemplate integ', () => {
    const playlist = [
        {
            type: 'dash',
            uri: vinylTestAssets.dash
                .live_static_video_audio_60s_2s_segmentTemplate,
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
