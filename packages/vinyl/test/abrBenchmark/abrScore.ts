/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { clamp } from '@amazon/vinyl-util'

/*
 * ABR QoE scoring.
 *
 * The timeline is event-driven: each sample is a state change at time
 * `time` (seconds from test start). Between consecutive samples the state
 * from the earlier sample is held. A sample with bandwidth=null represents
 * a period the engine was not playing (rebuffering, paused, or pre-start).
 *
 * Quality is scored as the time-weighted average of sqrt(bandwidth / maxBandwidth).
 *
 * All score components are in [0, 1]. The final score is a weighted average
 * of the components (NOT multiplicative). Display code is responsible for
 * scaling to 0–100 or any other presentation form.
 */

export type TimelineEventType =
    | 'playing'
    | 'waiting'
    | 'qualityChange'
    | 'paused'
    | 'ended'

export interface TimelineSample {
    time: number // seconds from test start
    bandwidth: number | null // bits/sec while playing, null otherwise
    event: TimelineEventType // 'waiting' marks a rebuffer start
}

export interface AbrScoreBreakdown {
    // All values are 0–1 (1 = ideal).
    quality: number
    rebuffer: number
    stall: number
    startup: number
    finalScore: number

    // diagnostics
    avgBitrate: number
    rebufferCount: number
    totalStallSeconds: number
    playbackSeconds: number
}

export interface AbrScoreResult {
    breakdown: AbrScoreBreakdown
}

/**
 * Weights used to combine components into the final score. Must sum to 1.
 */
export const ABR_WEIGHTS = {
    quality: 0.4,
    rebuffer: 0.3,
    stall: 0.1,
    startup: 0.2,
}

/**
 * Decay constants for converting raw penalties into [0, 1] component scores.
 * Each score takes the form `1 / (1 + k * penalty)` — 1 at zero penalty,
 * asymptotically approaching 0 as penalty grows.
 */
const REBUFFER_DECAY = 1.0 // per event
const STALL_DECAY = 0.25 // per second
const STARTUP_DECAY = 0.5 // per second

/**
 * Compute ABR QoE score from an event-driven timeline.
 *
 * @param timeline  Event samples, ordered by time.
 * @param endTime   Seconds from test start at which the run ended (used to
 *                  close out the last interval).
 * @param startupSeconds  Seconds between play() and first 'playing' event.
 * @param maxBandwidth  Best-known max available bandwidth (bits/sec).
 */
export function computeAbrScore(
    timeline: TimelineSample[],
    endTime: number,
    startupSeconds: number,
    maxBandwidth: number | null
): AbrScoreResult {
    let playbackSeconds = 0
    let bitrateSecondsSum = 0 // Σ duration * bandwidth (for avg)
    let weightedSqrtRatio = 0 // Σ duration * sqrt(bandwidth / maxBandwidth)
    let stallSeconds = 0
    let rebufferCount = 0
    let hasStarted = false

    for (let i = 0; i < timeline.length; i++) {
        const cur = timeline[i]
        const next = i + 1 < timeline.length ? timeline[i + 1].time : endTime
        const duration = Math.max(0, next - cur.time)

        if (cur.bandwidth && cur.bandwidth > 0) {
            hasStarted = true
            playbackSeconds += duration
            bitrateSecondsSum += duration * cur.bandwidth
            if (maxBandwidth && maxBandwidth > 0) {
                const ratio = Math.min(1, cur.bandwidth / maxBandwidth)
                weightedSqrtRatio += duration * Math.sqrt(ratio)
            }
        } else if (hasStarted && cur.event === 'waiting') {
            // Stall = time between a 'waiting' event and the next playback
            // resume. `paused` / `ended` also produce null-bandwidth samples
            // but are not stalls.
            stallSeconds += duration
            rebufferCount++
        }
    }

    let quality = 0
    if (playbackSeconds > 0 && maxBandwidth && maxBandwidth > 0) {
        quality = clamp(weightedSqrtRatio / playbackSeconds, 0, 1)
    }

    // A run with zero playback is a total failure (startup never completed
    // or every attempt stalled). Perfect rebuffer/stall/startup scores would
    // be misleading, so score it as zero.
    if (playbackSeconds === 0) {
        return {
            breakdown: {
                quality: 0,
                rebuffer: 0,
                stall: 0,
                startup: 0,
                finalScore: 0,
                avgBitrate: 0,
                rebufferCount,
                totalStallSeconds: stallSeconds,
                playbackSeconds: 0,
            },
        }
    }

    const rebuffer = 1 / (1 + REBUFFER_DECAY * rebufferCount)
    const stall = 1 / (1 + STALL_DECAY * stallSeconds)
    const startup = 1 / (1 + STARTUP_DECAY * Math.max(0, startupSeconds))

    const finalScore =
        ABR_WEIGHTS.quality * quality +
        ABR_WEIGHTS.rebuffer * rebuffer +
        ABR_WEIGHTS.stall * stall +
        ABR_WEIGHTS.startup * startup

    return {
        breakdown: {
            quality,
            rebuffer,
            stall,
            startup,
            finalScore,
            avgBitrate:
                playbackSeconds > 0 ? bitrateSecondsSum / playbackSeconds : 0,
            rebufferCount,
            totalStallSeconds: stallSeconds,
            playbackSeconds,
        },
    }
}
