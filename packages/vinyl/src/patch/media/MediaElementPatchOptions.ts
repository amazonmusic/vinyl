/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy } from '@amazon/vinyl-util'
import { requiresUnreliablePlaybackEventsPatch } from './patches/createUnreliablePlaybackEventsPatch'
import { requiresPreventStallsPatch } from '@/patch/media/patches/createPreventStallsPatch'

export interface MediaElementPatchOptions {
    /**
     * Playback events 'playing' and 'waiting' are unreliable after seeking.
     *
     * Risks for false positive: LOW. Timing of emitted playing events may be subtly
     * different, but they will not be duplicated.
     * Risks for false negative: MEDIUM. Certain playback events on affected platforms will be missed.
     */
    readonly unreliablePlaybackEvents?: boolean

    /**
     * The affected user agent gets into a state where playback can become stalled and needs help getting unstuck.
     */
    readonly preventStalls?: boolean
}

/**
 * Aggregates flags for toggling patches.
 */
export const defaultMediaElementPatchOptions = lazy<
    Required<MediaElementPatchOptions>
>(() => {
    return {
        unreliablePlaybackEvents: requiresUnreliablePlaybackEventsPatch(),
        preventStalls: requiresPreventStallsPatch(),
    } as const satisfies Required<MediaElementPatchOptions>
})
