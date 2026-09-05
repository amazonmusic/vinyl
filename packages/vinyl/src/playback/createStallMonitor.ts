/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createDisposer, type Timestamp } from '@amazon/vinyl-util'
import type { ReadonlyPlaybackController } from './ReadonlyPlaybackController'
import { StallEndedReason } from './ReadonlyPlaybackController'

export interface StallMonitorOptions {
    /**
     * Seconds the play head must be frozen (no `timeUpdate`) while playing before a stall is
     * reported. Default: 1
     */
    readonly stallThreshold?: number

    /**
     * How often (seconds) the play head freeze is checked. Default: 0.25
     */
    readonly pollInterval?: number
}

export interface StallEndedInfo {
    /** Time of the last `timeUpdate` observed before the play head froze. */
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
 * Watches a {@link ReadonlyPlaybackController} for stalls while playing: the play head freezing
 * (no `timeUpdate`) for longer than {@link StallMonitorOptions.stallThreshold} seconds.
 *
 * Detection only runs once playback has actually been observed (a `playing` event) and is
 * suspended on `pause`/`seeking`/`emptied` until playback is observed again — so a stall is never
 * reported during initial loading or while awaiting a seek. A detected stall ends when the play
 * head advances again (`playing`) or playback stops for another reason (`pause`/`seeking`/
 * `emptied`); {@link StallEndedInfo.duration} is measured from the last `timeUpdate` before the
 * freeze, so it reflects the full frozen time rather than only the time past the threshold.
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

    // Only detect once playback has been observed; gates out initial load and post-seek buffering.
    let observedPlaying = false
    // Wall-clock time of the last `timeUpdate` — the reference start of any freeze.
    let lastProgressAt = Date.now()
    let inStall = false
    let pollId: ReturnType<typeof setInterval> | null = null

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

    const startPoll = (): void => {
        if (pollId != null) return
        pollId = setInterval(() => {
            if (inStall || !observedPlaying) return
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
        observedPlaying = false
        stopPoll()
    }

    const { add, dispose } = createDisposer()

    add(
        controller.on('playing', () => {
            // Resuming from a stall closes it; otherwise this is a fresh start of playback, so
            // begin the freeze clock now (no `timeUpdate` has necessarily arrived yet).
            if (inStall) endStall(StallEndedReason.PLAYING)
            else lastProgressAt = Date.now()
            observedPlaying = true
            startPoll()
        })
    )
    add(
        controller.on('timeUpdate', () => {
            // The play head advanced: close any open stall, then reset the freeze clock.
            if (inStall) endStall(StallEndedReason.PLAYING)
            lastProgressAt = Date.now()
        })
    )
    add(controller.on('pause', () => suspend(StallEndedReason.PAUSE)))
    add(controller.on('seeking', () => suspend(StallEndedReason.SEEKING)))
    add(controller.on('emptied', () => suspend(StallEndedReason.EMPTIED)))

    let stopped = false
    return () => {
        if (stopped) return
        stopped = true
        stopPoll()
        dispose()
    }
}
