/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import any = jasmine.any
import {
    type PlaybackControllerEventMap,
    PlayedReason,
    type VinylPlayer,
} from '@amazon/vinyl'
import { sleep } from '@amazon/vinyl-util'
import { createVinylSuite, vinylTestAssets } from '@amazon/vinyl/vinylTestUtil'

import { createEventSpy, type EventSpy } from '@amazon/vinyl-util/testUtil'

/**
 * The amount of time to play
 */
const PLAYBACK_TIME = 2

describe('integ playing and played events', () => {
    const suite = createVinylSuite()
    let player: VinylPlayer
    let playingSpy: EventSpy<PlaybackControllerEventMap, 'playing'>
    let playSpy: EventSpy<PlaybackControllerEventMap, 'play'>
    let playedSpy: EventSpy<PlaybackControllerEventMap, 'played'>

    beforeEach(() => {
        player = suite.player
        playingSpy = createEventSpy(player, 'playing')
        playSpy = createEventSpy(player, 'play')
        playedSpy = createEventSpy(player, 'played')
    })

    async function play(): Promise<void> {
        player.load({
            type: 'src',
            uri: vinylTestAssets.prog.libmp3lame_60s_2ch_16bit_44100Hz_48kbps,
        })
        await player.play()
    }

    afterEach(() => {
        suite.player.defaultPlaybackRate = 1
    })

    describe('when playback is started', () => {
        it('emits play then playing', async () => {
            const nextPlay = playSpy.next(10)
            const nextPlaying = playingSpy.next(10)
            await play()
            await nextPlay
            await nextPlaying
            expect(playSpy).toHaveBeenCalledBefore(playingSpy)
        })

        describe('then playback is paused', () => {
            it('emits played', async () => {
                // Play until pause()
                player.defaultPlaybackRate = 0.5
                await play()
                // started should be close to this, but not exactly:
                const expectedStarted = Date.now()
                await sleep(PLAYBACK_TIME)
                playingSpy.calls.reset()
                playedSpy.calls.reset() // May have had re-buffers
                const nextPlayed = playedSpy.next(1)
                player.pause()
                const playedEvent = await nextPlayed
                expect(playedEvent).toEqual({
                    started: any(Number),
                    reason: PlayedReason.PAUSE,
                    ended: any(Number),
                    playbackTime: any(Number),
                    duration: any(Number),
                })
                expect(playedEvent.started)
                    .withContext('started')
                    .toBeCloseToWithin(expectedStarted, 1000)
                expect(playedEvent.ended)
                    .withContext('ended')
                    .toBeCloseToWithin(
                        expectedStarted + PLAYBACK_TIME * 1000,
                        500
                    )
                expect(playedEvent.duration)
                    .withContext('duration')
                    .toBeCloseToWithin(PLAYBACK_TIME, 0.2)
                expect(playingSpy).not.toHaveBeenCalled()
            })
        })

        describe('then a seek is requested', () => {
            it('emits played', async () => {
                // Play until seekTo()
                await play()
                playedSpy.calls.reset()
                playingSpy.calls.reset()
                const nextPlayed = playedSpy.next()
                const nextPlaying = playingSpy.next()
                await player.seekTo(20)
                await expectAsync(nextPlayed).toBeResolvedTo({
                    started: any(Number),
                    ended: any(Number),
                    duration: any(Number),
                    playbackTime: any(Number),
                    // Firefox may emit the 'waiting' event before the 'seeking'.
                    // While not ideal, not worth a patch.
                    reason: any(String),
                })
                await expectAsync(nextPlaying).toBeResolved()
                expect(playedSpy).toHaveBeenCalledBefore(playingSpy)
            })
        })
    })

    describe('when seeking while paused', () => {
        it('does not emit playing', async () => {
            await play()
            const nextPlayed = playedSpy.next()
            playingSpy.calls.reset()
            player.pause()
            await player.seekTo(25)
            await expectAsync(nextPlayed).toBeResolved()
            await sleep(0.5)
            expect(playingSpy).not.toHaveBeenCalled()
        })
    })
})
