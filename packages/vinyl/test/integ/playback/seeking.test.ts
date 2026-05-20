/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type VinylPlayer, type VinylTrackLoadOptions } from '@amazon/vinyl'
import { MediaUnsupportedError, nextEventAsPromise } from '@amazon/vinyl-util'
import {
    assertFrequency,
    createVinylSuite,
    expectTrackCanSeekTo,
    vinylTestAssets,
} from '@amazon/vinyl/vinylTestUtil'

describe('seeking integ', () => {
    const suite = createVinylSuite()
    let player: VinylPlayer

    // Runs all seeking integration tests for each type of track listed.
    const trackSuites: {
        readonly description: string
        readonly track: VinylTrackLoadOptions
    }[] = [
        {
            description: 'dash with segmentBase',
            track: {
                type: 'dash',
                uri: vinylTestAssets.dash
                    .live_static_aac_opus_flac_60s_segmentBase,
            },
        },
    ]

    function addWhenSeekingRapidlyTests() {
        describe('when seeking rapidly', () => {
            it('the last seek should be honored', async () => {
                const promises: Promise<void>[] = [] // All expected to be aborted.
                promises.push(player.seekTo(12))
                promises.push(player.seekTo(15))
                promises.push(player.seekTo(15.1))
                promises.push(player.seekTo(30))
                promises.push(player.seekTo(30.5))
                promises.push(player.seekTo(5))
                promises.push(player.seekTo(25))

                const FINAL = 50
                const TOLERANCE = 1
                const finalPromise = player.seekTo(FINAL)

                await Promise.all(promises)

                await finalPromise

                // The last seek should match the final seekTo time
                expect(player.currentTime).toBeCloseToWithin(FINAL, TOLERANCE)

                if (!player.paused) {
                    await assertFrequency()
                }
            })
        })
    }

    beforeEach(() => {
        player = suite.player
    })

    for (const trackSuite of trackSuites) {
        describe(trackSuite.description, () => {
            beforeEach(async () => {
                try {
                    player.load(trackSuite.track)
                } catch (error) {
                    if (error instanceof MediaUnsupportedError)
                        pending('Track type not supported')
                    else throw error
                    return
                }
                await player.play()
            })

            describe('when playing', () => {
                it('can seek to a time', async () => {
                    expect(player.paused).withContext('paused').toBeFalse() // sanity check
                    expect(player.playing).withContext('playing').toBeTrue()
                    await expectTrackCanSeekTo(player, 10)
                    await expectTrackCanSeekTo(player, 20)
                    await expectTrackCanSeekTo(player, 5)
                    await expectTrackCanSeekTo(player, 0)
                })

                it('clamps when seeking to beyond duration', async () => {
                    await expectTrackCanSeekTo(player, 999)
                })

                addWhenSeekingRapidlyTests()
            })

            describe('when paused', () => {
                beforeEach(() => {
                    player.pause()
                })

                it('can seek to a time', async () => {
                    await expectTrackCanSeekTo(player, 12)
                    await expectTrackCanSeekTo(player, 25)
                    await expectTrackCanSeekTo(player, 7)
                    await expectTrackCanSeekTo(player, 0)
                })

                it('clamps when seeking to beyond duration', async () => {
                    await expectTrackCanSeekTo(player, 999)
                })

                addWhenSeekingRapidlyTests()
            })

            describe('when track is segmented', () => {
                beforeEach(() => {
                    if (trackSuite.track.type !== 'dash')
                        pending('not segmented')
                })

                it('can seek close to end and start of segment boundaries', async () => {
                    await expectTrackCanSeekTo(player, 39.9)
                    await expectTrackCanSeekTo(player, 59.99)
                    await expectTrackCanSeekTo(player, 30.01)
                    await expectTrackCanSeekTo(player, 9.999)
                })

                it('no-ops seeks when time is close to currentTime', async () => {
                    await expectTrackCanSeekTo(player, 39.9)
                    await expectTrackCanSeekTo(player, 40.1)
                    await expectTrackCanSeekTo(player, 40.0)
                })
            })

            describe('after track ends', () => {
                it('can seek back to beginning', async () => {
                    const nextEnded = nextEventAsPromise(player, 'ended')
                    await expectTrackCanSeekTo(player, 999)
                    await nextEnded
                    await expectTrackCanSeekTo(player, 0)
                    await expectTrackCanSeekTo(player, 5)
                })

                it('can continue seeking', async () => {
                    const nextEnded = nextEventAsPromise(player, 'ended')
                    await expectTrackCanSeekTo(player, 999)
                    await nextEnded
                    await expectTrackCanSeekTo(player, 0)
                    await expectTrackCanSeekTo(player, 5)
                    await expectTrackCanSeekTo(player, 15)
                    await expectTrackCanSeekTo(player, 35)
                    await expectTrackCanSeekTo(player, 999)
                    await nextEnded
                })
            })
        })
    }
})
