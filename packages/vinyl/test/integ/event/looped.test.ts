/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createVinylSuite, vinylTestAssets } from '@amazon/vinyl/vinylTestUtil'

import { createEventSpy } from '@amazon/vinyl-util/testUtil'

describe('looped integ', () => {
    const suite = createVinylSuite()

    describe('when playback looped', () => {
        it('dispatches looped event', async () => {
            const player = suite.player
            player.load({
                type: 'dash',
                uri: vinylTestAssets.dash
                    .live_static_aac_opus_flac_60s_segmentBase,
            })
            await player.play()
            const loopedSpy = createEventSpy(player, 'looped')
            const endedSpy = createEventSpy(player, 'ended')

            player.loop = true
            // 1 minute track, seek to end
            await player.seekTo(player.duration)
            expect(loopedSpy).not.toHaveBeenCalled()
            await loopedSpy.next(20, 'looped 1 timed out in {timeout}s')
            expect(loopedSpy).toHaveBeenCalledTimes(1)
            loopedSpy.calls.reset()

            // Should not be called on seeking
            await player.seekTo(30)
            await player.seekTo(0)
            expect(loopedSpy).not.toHaveBeenCalled()

            // Loop again
            await player.seekTo(player.duration)
            await loopedSpy.next(20, 'looped 2 timed out in {timeout}s')
            expect(loopedSpy).toHaveBeenCalledTimes(1)
            loopedSpy.calls.reset()
            expect(player.currentTime).toBeLessThan(1)
            expect(endedSpy).not.toHaveBeenCalled()
            expect(player.ended).withContext('ended').toBeFalse()

            // Turn off loop, expect media can end.
            player.loop = false
            const nextEnded = endedSpy.next(20)
            await player.seekTo(player.duration)
            await expectAsync(nextEnded).toBeResolved()
            expect(player.currentTime).toBeGreaterThan(player.duration - 0.5)
            expect(loopedSpy).not.toHaveBeenCalled()
            expect(player.ended).withContext('ended').toBeTrue()
        })
    })
})
