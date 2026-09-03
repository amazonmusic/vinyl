/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VinylPlayer } from '@amazon/vinyl'
import { DrmKeySystem } from '@amazon/vinyl'
import { memoize } from '@amazon/vinyl-util'

/**
 * Marks the test suite as pending if Widevine is not supported.
 * Returns true if not supported.
 *
 * @param player
 */
export const pendingIfWidevineNotSupported = memoize(
    async (player: VinylPlayer): Promise<boolean> => {
        if (
            !(
                await player.client.capabilities.supportsKeySystem(
                    DrmKeySystem.WIDEVINE
                )
            ).supported
        ) {
            pending('requires Widevine')
            return true
        }
        return false
    },
    () => {}
)
