/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createDisposer, type Timestamp } from '@amazon/vinyl-util'
import type { ReadonlyPlaybackController } from './ReadonlyPlaybackController'
import { StallEndedReason } from './ReadonlyPlaybackController'

export interface StallMonitorOptions {
    /**
     * Seconds the play head must be frozen (`currentTime` not advancing) while playing before a
     * stall is reported. Default: 1
     */
    readonly stallThreshold?: number

    /**
     * How often (seconds) the play head freeze is checked. Default: 0.25
     */
    readonly pollInterval?: number
}

export interface StallEndedInfo {
    /** Time of the last progress observed before the play head froze. */
    readonly started: Timestamp
    /** Time the stall ended. */
    readonly ended: Timestamp
    /** Total seconds the play head was frozen. */
    readonly duration: number
    /** Why the stall ended. */
    readonly reason: StallEndedReason
}

export interface StallMonitorCallbacks {
    /** Called when a stall is first detected. */
    readonly onStallEntered: () => void
    /** Called when a detected stall ends. */
    readonly onStallEnded: (info: StallEndedInfo) => void
}

/**
 * Minimum forward `currentTime` change (seconds) that counts as real progress. Guards the
 * progress check against floating-point jitter so a negligible advance isn't mistaken for the
 * play head moving.
 */
const PROGRESS_EPSILON = 1e-6

/**
 * Watches a {@link ReadonlyPlaybackController} for stalls while playing: the play head freezing
 * (`currentTime` not advancing) for longer than {@link StallMonitorOptions.stallThreshold} seconds.
 *
 * Progress is observed both from `timeUpdate` events and by reading `currentTime` on each poll. A
 * late `timeUpdate` alone is not a stall: when the main thread is busy (a long task, a GC pause) or
 * event delivery is delayed, the play head keeps advancing while no `timeUpdate` reaches script,
 * and the poll sees that advance rather than reporting a freeze.
 *
 * Detection only runs once playback has actually been observed (a `playing` event) and is
 * suspended on `pause`/`seeking`/`emptied` until playback is observed again — so a stall is never
 * reported during initial loading or while awaiting a seek. A detected stall ends when the play
 * head advances again (`playing`) or playback stops for another reason (`pause`/`seeking`/
 * `emptied`); {@link StallEndedInfo.duration} is measured from the last observed progress before
 * the freeze, so it reflects the full frozen time rather than only the time past the threshold.
 *
 * Returns a function that stops the monitor.
 */
export function createStallMonitor(
    controller: ReadonlyPlaybackController,
    callbacks: StallMonitorCallbacks,
    options: StallMonitorOptions = {}
): () => void {
    const stallThresholdMs = (options.stallThreshold ?? 1) * 1000
    const pollIntervalMs = (options.pollInterval ?? 0.25) * 1000

    // Wall-clock time of the last observed progress — the reference start of any freeze.
    let lastProgressAt = Date.now()
    // Play head position at the last observed progress.
    let lastProgressPosition = controller.currentTime
    let inStall = false
    let pollId: ReturnType<typeof setInterval> | null = null

    const { add, dispose } = createDisposer()

    const endStall = (reason: StallEndedReason): void => {
        if (!inStall) return
        inStall = false
        const ended = Date.now()
        callbacks.onStallEnded({
            started: lastProgressAt,
            ended,
            duration: (ended - lastProgressAt) / 1000,
            reason,
        })
    }

    const stopPoll = (): void => {
        if (pollId == null) return
        clearInterval(pollId)
        pollId = null
    }
    add(stopPoll)

    const markProgress = (): void => {
        lastProgressAt = Date.now()
        lastProgressPosition = controller.currentTime
    }

    const startPoll = (): void => {
        if (pollId != null) return
        // Polls only while playback is observed — started on `playing`, stopped by `suspend` —
        // which gates out initial load and post-seek buffering.
        pollId = setInterval(() => {
            // The play head advanced without a `timeUpdate` reaching us yet (e.g. a long task
            // delayed it past this poll): that's progress, not a freeze.
            if (
                controller.currentTime - lastProgressPosition >
                PROGRESS_EPSILON
            ) {
                if (inStall) endStall(StallEndedReason.PLAYING)
                markProgress()
                return
            }
            if (inStall) return
            if (Date.now() - lastProgressAt >= stallThresholdMs) {
                inStall = true
                callbacks.onStallEntered()
            }
        }, pollIntervalMs)
    }

    // Playback stopped for a non-resume reason: close any open stall and suspend detection until
    // playback is observed again.
    const suspend = (reason: StallEndedReason): void => {
        endStall(reason)
        stopPoll()
    }

    add(
        controller.on('playing', () => {
            // Resuming from a stall closes it (using the pre-resume freeze start for its duration).
            if (inStall) endStall(StallEndedReason.PLAYING)
            // Whether resuming or freshly starting, the play head is advancing again, so restart the
            // freeze clock. Without this the poll could immediately re-detect a stall from the stale
            // pre-freeze timestamp before the first post-resume `timeUpdate` resets it.
            markProgress()
            startPoll()
        })
    )
    add(
        controller.on('timeUpdate', ({ previous, current }) => {
            // Browsers emit `timeUpdate` while frozen (unchanged/backward `currentTime`); only a
            // forward advance is progress, else a stall is ended and re-detected, doubling events.
            if (previous != null && current - previous <= PROGRESS_EPSILON)
                return
            // The play head advanced: close any open stall, then reset the freeze clock.
            if (inStall) endStall(StallEndedReason.PLAYING)
            markProgress()
        })
    )
    add(controller.on('pause', () => suspend(StallEndedReason.PAUSE)))
    add(controller.on('seeking', () => suspend(StallEndedReason.SEEKING)))
    add(controller.on('emptied', () => suspend(StallEndedReason.EMPTIED)))

    return dispose
}
