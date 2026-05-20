/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createVinylSuite,
    expectTrackPlaysUntil,
    onDuration,
    vinylTestAssets,
} from '@amazon/vinyl/vinylTestUtil'

describe('progressive integ', () => {
    const suite = createVinylSuite()

    it('plays', async () => {
        const player = suite.player
        // On slow connections, seeking on a progressive track can be
        // extraordinarily slow. This isn't a vinyl bug, it's the point
        // of using Dash or HLS. Do not use expectTrackPlays, it will
        // give intermittent failures in BrowserStack.
        player.load({
            type: 'src',
            uri: vinylTestAssets.prog.libmp3lame_60s_2ch_16bit_44100Hz_48kbps,
        })
        await player.play()
        await onDuration(player)
        await expectTrackPlaysUntil(player, player.currentTime + 3)
    })

    it('provides the extra property from load config for active track', () => {
        const player = suite.player
        player.load({
            type: 'src',
            uri: vinylTestAssets.prog.libmp3lame_60s_2ch_16bit_44100Hz_48kbps,
            config: {
                extra: 1,
            },
        })
        player.preload({
            type: 'src',
            uri: vinylTestAssets.prog.libmp3lame_60s_2ch_16bit_44100Hz_48kbps,
            config: {
                extra: 2,
            },
        })
        expect(player.currentTrack?.extra).toBe(1)
        player.load({
            type: 'src',
            uri: vinylTestAssets.prog.libmp3lame_60s_2ch_16bit_44100Hz_48kbps,
            config: {
                extra: 2,
            },
        })
        const track = player.currentTrack
        expect(track?.extra).toBe(2)
        player.unload()
        expect(track?.extra).toBeNull()
    })
})
