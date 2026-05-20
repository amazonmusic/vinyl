/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createVinylSuite, vinylTestAssets } from '@amazon/vinyl/vinylTestUtil'
import { type VinylTrackLoadOptions } from '@amazon/vinyl'

import { nextEventAsPromise } from '@amazon/vinyl-util'
import { createShortUid } from '@amazon/vinyl-util'

describe('trackController integ', () => {
    function createLoadOptionsList(count: number): VinylTrackLoadOptions[] {
        const loadOptions: VinylTrackLoadOptions[] = []
        for (let i = 0; i < count; i++) {
            loadOptions.push({
                type: 'src',
                uri: `${
                    vinylTestAssets.prog.libmp3lame_60s_2ch_16bit_44100Hz_48kbps
                }?track=${createShortUid()}_${i}`,
            })
        }
        return loadOptions
    }

    describe('load', () => {
        const suite = createVinylSuite({
            trackController: {
                preloadCapacity: 1,
                trackPrefetchCount: 3,
            },
        })

        it('prefetches trackPrefetchCount tracks ahead', () => {
            const tracks = createLoadOptionsList(7)
            const player = suite.player
            function expectCached(indices: readonly number[]) {
                for (let i = 0; i < 6; i++) {
                    const expected = indices.includes(i)
                    expect(player.isTrackCached(tracks[i].uri))
                        .withContext(`track ${i}`)
                        .toBe(expected)
                }
            }

            // no need to await, not waiting load. Ignore abort rejection.
            // preloadCapacity set to 1 means 1 track behind current should remain in cache.
            player.load(...tracks)
            expectCached([0, 1, 2, 3]) // indices 1-3 prefetched, 0 is current.
            player.next()
            expectCached([0, 1, 2, 3, 4]) // 2-4 prefetched, 1 is current
            player.next()
            expectCached([1, 2, 3, 4, 5]) // 3-5 prefetched, 2 is current
            player.next()
            expectCached([2, 3, 4, 5, 6]) // 3-5 prefetched, 2 is current, 0 evicted
            player.next()
            expectCached([2, 3, 4, 5, 6]) // 4-6 prefetched, 3 is current
        })

        it('moves to the next track on ended', async () => {
            const count = 3
            const tracks = createLoadOptionsList(count)
            const duration = 60
            const player = suite.player
            player.load(...tracks)
            expect(player.currentTrack?.uri).toEqual(tracks[0].uri)
            await player.play()
            for (let i = 0; i < count - 1; i++) {
                const nextTrackChange = nextEventAsPromise(
                    player,
                    'currentTrackChange',
                    {
                        timeout: 30,
                        timeoutMessage:
                            'currentTrackChange timed out in {time}s',
                    }
                )
                await player.seekTo(duration)
                await nextTrackChange

                expect(player.currentTrack?.uri).toEqual(tracks[i + 1].uri)
            }
            const nextQueueEnded = nextEventAsPromise(player, 'queueEnded', {
                timeout: 30,
                timeoutMessage: 'queueEnded timed out in 10s',
            })
            await player.seekTo(duration)
            await nextQueueEnded
            expect(player.currentTrack?.uri).toEqual(tracks[count - 1].uri) // Remain on the last track
        })
    })
})
