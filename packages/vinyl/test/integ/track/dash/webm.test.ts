/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createVinylSuite,
    expectTrackPlaysUntil,
    vinylTestAssets,
} from '@amazon/vinyl/vinylTestUtil'
import { onDuration } from '@amazon/vinyl/vinylTestUtil'

describe('dash webm integ', () => {
    const vinylSuite = createVinylSuite()

    const uri = vinylTestAssets.dash.live_static_webm_vp9_opus_60s_segmentBase

    it('reports the manifest duration', async () => {
        vinylSuite.player.load({ type: 'dash', uri })
        await vinylSuite.player.play()
        await onDuration(vinylSuite.player)
        expect(vinylSuite.player.duration).toBeGreaterThan(0)
    })

    it('plays VP9 + Opus WebM (SegmentBase / EBML Cues)', async () => {
        vinylSuite.player.load({ type: 'dash', uri })
        await vinylSuite.player.play()
        await expectTrackPlaysUntil(vinylSuite.player, 8)
    })

    it('plays after seeking into the stream', async () => {
        vinylSuite.player.load({ type: 'dash', uri })
        await vinylSuite.player.play()
        await vinylSuite.player.seekTo(30)
        await expectTrackPlaysUntil(vinylSuite.player, 36)
    })
})
