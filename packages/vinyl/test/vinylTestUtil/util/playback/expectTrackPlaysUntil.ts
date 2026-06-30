/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { onPlaying, onTimeUpdate } from './eventPromises'
import { assertFrequency } from '../../media/FrequencyAnalyzer'
import type { ReadonlyPlaybackController } from '@amazon/vinyl'
import { sleep } from '@amazon/vinyl-util'

const sleepInterval = 1
const affordanceBefore = 1
const affordanceAfter = 3

/**
 * Plays until a given end time. If the end time is not reached in an acceptable
 * time frame, the test fails.
 *
 * @param player
 * @param endTime
 * @param timeout A timeout beyond the expected amount of time to play.
 * This does not affect waiting for ready state.
 */
export async function expectTrackPlaysUntil(
    player: ReadonlyPlaybackController,
    endTime: number,
    timeout = 10
) {
    await onPlaying(player)
    // Safari does not always have an updated currentTime after a seeked event. Await the next time update before
    // asserting currentTime values.
    await onTimeUpdate(player)
    expect(player.currentTime)
        .withContext('currentTime must be less than endTime')
        .toBeLessThan(endTime)
    await assertFrequency()

    let elapsed = 0
    const maxTime = endTime - player.currentTime + timeout
    while (!player.ended && player.currentTime < endTime && elapsed < maxTime) {
        await sleep(sleepInterval)
        elapsed += sleepInterval
    }
    expect(player.currentTime)
        .withContext('currentTime')
        .toBeGreaterThanOrEqual(endTime - affordanceBefore)
    expect(player.currentTime)
        .withContext('currentTime')
        .toBeLessThan(endTime + affordanceAfter)
}
