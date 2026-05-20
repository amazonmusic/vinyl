/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type PlaybackControllerEventMap,
    type VinylPlayer,
} from '@amazon/vinyl'
import type { AnyRecord } from '@amazon/vinyl-util'
import { noop } from '@amazon/vinyl-util'
import {
    createVinylSuite,
    expectPausedState,
    expectPendingPlaying,
    expectPlayingState,
    expectTimeDoesNotElapse,
    expectTimeElapses,
    vinylTestAssets,
} from '@amazon/vinyl/vinylTestUtil'

import type { EventSpy } from '@amazon/vinyl-util/testUtil'
import { createEventSpy } from '@amazon/vinyl-util/testUtil'

describe('pause integ', () => {
    const suite = createVinylSuite()
    let player: VinylPlayer
    let pauseSpy: EventSpy<PlaybackControllerEventMap, 'pause'>
    let playSpy: EventSpy<PlaybackControllerEventMap, 'play'>
    let playRejectedSpy: EventSpy<PlaybackControllerEventMap, 'playRejected'>
    let playingSpy: EventSpy<PlaybackControllerEventMap, 'playing'>

    beforeEach(() => {
        player = suite.player
        pauseSpy = createEventSpy(player, 'pause')
        playSpy = createEventSpy(player, 'play')
        playRejectedSpy = createEventSpy(player, 'playRejected')
        playingSpy = createEventSpy(player, 'playing')
    })

    async function runPauseScenario() {
        const expectedEventPromise: Promise<AnyRecord> = player.playIsPending
            ? playRejectedSpy.next(1)
            : pauseSpy.next(1)
        player.pause()
        await expectedEventPromise
        expectPausedState(player)
        await expectTimeDoesNotElapse(player)
    }

    async function runPlayingScenario() {
        const nextPlay = playSpy.next(10)
        const nextPlaying = playingSpy.next(10)
        const playPromise = player.play()
        expectPendingPlaying(player)
        await nextPlay
        await playPromise
        await nextPlaying
        expectPlayingState(player)
        await expectTimeElapses(player)
    }

    it('can pause when playing', async () => {
        expect(player.paused).withContext('initial paused').toBeTrue()
        player.load({
            type: 'src',
            uri: vinylTestAssets.prog.libmp3lame_60s_2ch_16bit_44100Hz_48kbps,
        })
        player.play().catch(noop)
        expectPendingPlaying(player)
        await runPauseScenario()
        await runPlayingScenario()
        await runPauseScenario()
        await runPlayingScenario()
        await runPauseScenario()
    })
})
