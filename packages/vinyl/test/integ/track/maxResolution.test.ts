/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { AbrStrategy } from '@amazon/vinyl'
import { createVinylSuite, vinylTestAssets } from '@amazon/vinyl/vinylTestUtil'
import { poll } from '@amazon/vinyl-util'

describe('max resolution integ', () => {
    const suite = createVinylSuite()

    it('applies a lowered max resolution to the playing quality without waiting for the buffer to drain', async () => {
        const player = suite.player
        // BEST so the player starts at the highest available resolution
        // (the asset offers 360p / 720p / 1080p video).
        player.configure({
            abr: { ...player.options.abr, strategy: AbrStrategy.BEST },
        })
        player.load({
            type: 'hls',
            uri: vinylTestAssets.hls.vinyl_ad_breaks_av,
        })
        await player.play()

        // Wait until a resolution above the cap we're about to set is playing.
        const startedHigh = await poll(
            () => (player.getPlaybackQuality('video')?.height ?? 0) > 360,
            { timeout: 20 }
        )
        expect(startedHigh).withContext('started playing above 360p').toBeTrue()

        // Lower the cap. The prefetched/buffered higher-res content must be
        // cleared so the capped quality is selected promptly, rather than only
        // after the old buffer drains.
        player.configure({ abr: { ...player.options.abr, maxHeight: 360 } })

        const cappedPromptly = await poll(
            () =>
                (player.getPlaybackQuality('video')?.height ?? Infinity) <= 360,
            { timeout: 10 }
        )
        expect(cappedPromptly)
            .withContext('playing quality dropped to <=360p promptly')
            .toBeTrue()
        expect(player.getPlaybackQuality('video')?.height).toBeLessThanOrEqual(
            360
        )
    })
})
