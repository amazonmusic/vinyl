/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Maybe } from '@amazon/vinyl-util'
import type { AdBreakPlacement } from './AdBreakInfo'

/**
 * How close to the start or end of the presentation a stitched break must be
 * to be classified as a pre-roll or post-roll, in seconds.
 */
const ROLL_EPSILON = 0.5

/**
 * Classifies a stitched break by where it sits in the presentation: a break
 * starting at the beginning is a pre-roll, one ending at the end is a
 * post-roll, and anything else is a mid-roll.
 */
export function classifyStitchedPlacement(
    startTime: number,
    duration: number | null,
    presentationDuration: Maybe<number>
): AdBreakPlacement {
    if (startTime <= ROLL_EPSILON) return 'preroll'
    if (
        duration != null &&
        presentationDuration != null &&
        Number.isFinite(presentationDuration) &&
        startTime + duration >= presentationDuration - ROLL_EPSILON
    ) {
        return 'postroll'
    }
    return 'midroll'
}
