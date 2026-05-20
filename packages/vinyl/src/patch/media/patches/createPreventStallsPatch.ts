/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Browser,
    closeTo,
    createDisposer,
    createLogPrefix,
    DomEventHost,
    hasBrowser,
    logInfo,
    type LogTarget,
    logWarn,
    noop,
} from '@amazon/vinyl-util'
import type { HtmlMediaElementPatch } from '@/patch/media/HtmlMediaElementPatch'

/**
 * The number of timeupdate events stuck at the same position before attempting to jiggle the playhead.
 * @private
 */
export const MAX_UNCHANGED_COUNT = 10

/**
 * On affected UAs, playback can become stuck. timeupdate events are observed but playback position is never changing.
 * This patch applies a workaround which will pause and play again after max number of timeupdate events with no
 * actual time progression.
 */
export function createPreventStallsPatch(
    media: HTMLMediaElement
): HtmlMediaElementPatch {
    const { add, dispose } = createDisposer()
    const domEvents = add(new DomEventHost<HTMLMediaElementEventMap>(media))
    const pathTarget: LogTarget = {
        logPrefix: createLogPrefix('createPreventStallsPatch'),
    }
    let unchangedCount = 0
    let attemptedFix = false
    let previousTime = media.currentTime
    domEvents.on('timeupdate', () => {
        if (media.paused) return
        if (closeTo(media.currentTime, previousTime, 0.01)) {
            if (++unchangedCount >= MAX_UNCHANGED_COUNT && !attemptedFix) {
                logWarn(
                    pathTarget,
                    `Detected stall at time ${media.currentTime}, attempting fix`
                )
                attemptedFix = true
                unchangedCount = 0
                media.pause()
                media.play().catch(noop)
            }
        } else {
            if (attemptedFix) {
                logInfo(pathTarget, 'stall ended')
                attemptedFix = false
            } // Unstuck
            unchangedCount = 0
            previousTime = media.currentTime
        }
    })

    return {
        dispose,
    }
}

/**
 * Returns true if stall detection should be enabled for the current user agent.
 */
export function requiresPreventStallsPatch(): boolean {
    return hasBrowser(Browser.EDGE_LEGACY)
}
