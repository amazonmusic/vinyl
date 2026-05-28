/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type PatchedRef, patchTargetFromFlags } from '@amazon/vinyl-util'
import type { MediaElementPatchOptions } from './MediaElementPatchOptions'
import { createUnreliablePlaybackEventsPatch } from './patches/createUnreliablePlaybackEventsPatch'
import { createPreventStallsPatch } from './patches/createPreventStallsPatch'

/**
 * Applies patches corresponding to the patch flags on the given media element.
 *
 * Adds logging for fabricated or squelched events.
 */
export function patchMediaElement<
    T extends HTMLMediaElement = HTMLMediaElement,
>(media: T, options: MediaElementPatchOptions): PatchedRef<T> {
    return patchTargetFromFlags(
        media,
        options,
        ['unreliablePlaybackEvents', createUnreliablePlaybackEventsPatch],
        ['preventStalls', createPreventStallsPatch]
    )
}
