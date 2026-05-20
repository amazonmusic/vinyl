/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    CapabilitiesImpl,
    type CapabilitiesImplDeps,
    createVinylPlayer,
    type VinylTrackLoadOptions,
} from '@amazon/vinyl'
import { mediaRef, onEnded, VinylSuite } from '@amazon/vinyl/vinylTestUtil'

import { sleep } from '@amazon/vinyl-util'
import { hasBrowser } from '@amazon/vinyl-util'
import { Browser } from '@amazon/vinyl-util'

describe('uhd integ', () => {
    class ForceUhdCapabilities extends CapabilitiesImpl {
        get sampleRate(): number | null {
            // Only up-sample for Chromium browsers
            if (hasBrowser(Browser.CHROMIUM)) {
                // Force all sample rates allowed:
                return Number.MAX_VALUE
            } else {
                return super.sampleRate
            }
        }
    }

    const suite = new VinylSuite(() => {
        return createVinylPlayer(
            {
                media: mediaRef.value,
            },
            {
                capabilities: (deps: CapabilitiesImplDeps) =>
                    new ForceUhdCapabilities(deps),
            }
        )
    })
    suite.init()

    const playlist: VinylTrackLoadOptions[] = [
        {
            type: 'dash',
            uri: `https://assets.dev.vinyl.music.amazon.dev/dash/world___bpm85/manifest.mpd`,
        },
    ]

    beforeEach(() => {
        if (!suite.player.capabilities.canPlayTypeMse('flac')) {
            pending('flac not supported')
        }
    })

    it('plays', async () => {
        const player = suite.player
        player.load(...playlist)
        await player.play()
        if (hasBrowser(Browser.CHROMIUM)) {
            // Only Chromium browsers will support up-sampling.
            expect(player.getPlaybackQuality('audio')?.audioSamplingRate).toBe([
                192_000, 192_000,
            ])
        }
        await sleep(25)
        expect(player.currentTime).toBeGreaterThan(20)
        await player.seekTo(player.duration - 3)
        await onEnded(player)
        expect(player.currentTime)
            .withContext('currentTime ends near duration')
            .toBeCloseToWithin(player.duration, 3)
    })
})
