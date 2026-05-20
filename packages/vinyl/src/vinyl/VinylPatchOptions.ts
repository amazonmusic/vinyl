/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MediaElementPatchOptions } from '@/patch/media/MediaElementPatchOptions'
import { defaultMediaElementPatchOptions } from '@/patch/media/MediaElementPatchOptions'
import { lazy } from '@amazon/vinyl-util'

/**
 * Flags for applying patches.
 * Default flags will be applied based on user agent, but may be overridden during player creation.
 */
export interface VinylPatchOptions {
    readonly media: MediaElementPatchOptions
}

export const defaultPatchOptions = lazy<VinylPatchOptions>(() => {
    return {
        media: defaultMediaElementPatchOptions.value,
    } as const satisfies VinylPatchOptions
})
