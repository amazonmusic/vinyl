/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppendMode, VinylDependencyOptions } from '@amazon/vinyl'
import { getSearchParams } from '@amazon/vinyl-util'

/**
 * The source buffer append mode the integ suite runs in, from the test page's
 * `appendMode` query parameter. The integ runners run the suite once per mode.
 * Default: 'segments' (the player default).
 */
export const integAppendMode: AppendMode =
    getSearchParams().get('appendMode') === 'sequence' ? 'sequence' : 'segments'

/**
 * Applies {@link integAppendMode} to player options, unless they set an append
 * mode themselves.
 */
export function withIntegAppendMode(
    options: Partial<VinylDependencyOptions> | undefined
): Partial<VinylDependencyOptions> {
    return {
        ...options,
        streaming: {
            ...options?.streaming,
            buffering: {
                ...options?.streaming?.buffering,
                appendMode:
                    options?.streaming?.buffering?.appendMode ??
                    integAppendMode,
            },
        },
    }
}
