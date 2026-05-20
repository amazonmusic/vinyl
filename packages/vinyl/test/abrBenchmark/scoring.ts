/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * Scoring engine for ABR benchmark results.
 *
 * Bridges the harness timeline output and the abrScore QoE computation.
 */

import {
    computeAbrScore,
    type AbrScoreResult,
    type TimelineSample,
} from './abrScore'

export interface HarnessResult {
    initialDelaySeconds: number
    maxBandwidth: number | null
    ended: boolean
    endTime: number
    timeline: Array<TimelineSample>
}

export function calculateScore(result: HarnessResult): AbrScoreResult {
    return computeAbrScore(
        result.timeline,
        result.endTime,
        result.initialDelaySeconds,
        result.maxBandwidth
    )
}
