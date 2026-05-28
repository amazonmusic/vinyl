/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Disposable } from '@amazon/vinyl-util'
import { createDisposer } from '@amazon/vinyl-util'
import { logDebug } from '@amazon/vinyl-util'
import type { ReadonlyPlaybackController } from '../ReadonlyPlaybackController'
import { ALL_PLAYBACK_STATE_EVENTS } from '../ReadonlyPlaybackController'
import { throttle } from '@amazon/vinyl-util'
import { substitute } from '@amazon/vinyl-util'
import { createLogPrefix, type LogTarget } from '@amazon/vinyl-util'

/**
 * The number of seconds to throttle timeupdate logs.
 * Logs will not be emitted for timeupdate events less than this interval.
 */
export const TIMEUPDATE_THROTTLE = 5

/**
 * @private
 */
const locale = {
    /**
     * The timeupdate log message when grouping several updates together.
     *
     * Param start - start time
     * Param end - end time
     * Param count - number of events
     */
    timeupdateLogBatch: 'timeUpdate {start}-{end} x{count}',
} as const

/**
 * Logs all playback state events.
 *
 * @param playbackState The event host with playback events to observe.
 * @return Returns a disposable handle to remove all added handlers.
 */
export function playbackStateLoggingHandler(
    playbackState: ReadonlyPlaybackController
): Disposable {
    const target: LogTarget = {
        logPrefix: createLogPrefix('Playback'),
    }
    const disposer = createDisposer()
    const { add } = disposer

    // Log time update events so that sequential time updates are debounced.
    let timeUpdateCount = 0
    let startTime: number | null = null

    /**
     * Logs the cumulated timeupdate event counts, resetting the window.
     */
    const logTimeupdateBatch = () => {
        if (startTime == null) return
        const currentTime = playbackState.currentTime
        logDebug(
            target,
            substitute(locale.timeupdateLogBatch, {
                start: startTime.toFixed(1),
                end: currentTime.toFixed(1),
                count: timeUpdateCount,
            })
        )
        timeUpdateCount = 0
        startTime = null
    }

    /**
     * Throttles timeupdate logs to the given interval.
     */
    const logTimeupdateBatchThrottled = add(
        throttle(logTimeupdateBatch, TIMEUPDATE_THROTTLE, { trailing: true })
    )

    add(
        playbackState.on('timeUpdate', () => {
            timeUpdateCount++
            if (startTime == null) startTime = playbackState.currentTime
            logTimeupdateBatchThrottled()
        })
    )

    for (const type of ALL_PLAYBACK_STATE_EVENTS) {
        if (type === 'timeUpdate') continue
        add(
            playbackState.on(type, (event) => {
                logTimeupdateBatch()
                logDebug(target, type, event)
            })
        )
    }

    return disposer
}
