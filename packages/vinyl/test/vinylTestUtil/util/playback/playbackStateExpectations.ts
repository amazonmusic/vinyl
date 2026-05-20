/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReadonlyPlaybackController } from '@amazon/vinyl'
import { sleep } from '@amazon/vinyl-util'
import { nextEventAsPromise } from '@amazon/vinyl-util'
import { closeTo } from '@amazon/vinyl-util'
import { expectNothing } from '@amazon/vinyl-util/browserTestUtil'

/**
 * Expects that the play head does not progress from the current time.
 * This is done with some flexibility; iOS for example after a pause may take some time to settle.
 */
export async function expectTimeDoesNotElapse(
    player: ReadonlyPlaybackController
) {
    const startTime = player.currentTime
    await sleep(0.5)
    if (closeTo(player.currentTime, startTime, 0.1)) {
        // After a short delay, time did not change.
        expectNothing()
    } else {
        // Increase the tolerance and wait longer.
        await sleep(2)
        expect(player.currentTime)
            .withContext('expectTimeDoesNotElapse')
            .toBeCloseToWithin(startTime, 0.3)
    }
}

/**
 * Expects that time progresses at least 0.5s within a timeout.
 */
export async function expectTimeElapses(player: ReadonlyPlaybackController) {
    // Waiting a set amount of time and querying currentTime is unreliable, even after
    // awaiting canPlayThrough.
    // Instead, assert that currentTime progresses within a time window.
    const minTimeDelta = 0.5
    const startTime = player.currentTime
    await nextEventAsPromise(player, 'timeUpdate', {
        filter: () => player.currentTime > startTime + minTimeDelta,
        timeout: 4,
        timeoutMessage: `currentTime did not progress at least ${minTimeDelta}s after {time} seconds.`,
    })
}

/**
 * Expects the player to be in a paused state.
 */
export function expectPausedState(player: ReadonlyPlaybackController) {
    expect(player.paused).withContext('paused').toBeTrue()
    expect(player.playing).withContext('not playing').toBeFalse()
}

/**
 * Expects the player to be in a playing state.
 */
export function expectPlayingState(player: ReadonlyPlaybackController) {
    expect(player.playIsPending).withContext('not pending play').toBeFalse()
    expect(player.paused).withContext('not paused').toBeFalse()
    expect(player.playing).withContext('playing').toBeTrue()
}

/**
 * Expects the current state to be pending play.
 */
export function expectPendingPlaying(player: ReadonlyPlaybackController) {
    expect(player.playIsPending).withContext('pending play').toBeTrue()
    expect(player.playing).withContext('pending, not playing').toBeFalse()
}
