/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VinylPlayer } from '@amazon/vinyl'
import { DrmKeySystem } from '@amazon/vinyl'
import { memoize } from '@amazon/vinyl-util'

/**
 * Marks the test suite as pending if Widevine is not supported.
 * @param player
 */
export const pendingIfWidevineNotSupported = memoize(
    async (player: VinylPlayer): Promise<void> => {
        try {
            const response = await fetch(
                'https://cwip-shaka-proxy.appspot.com/no_auth',
                {
                    method: 'OPTIONS',
                    mode: 'cors',
                }
            )
            if (!response.ok) {
                pending('shaka proxy rejected CORS')
                return
            }
        } catch (_error) {
            pending('shaka proxy could not be reached')
            return
        }

        if (location.hostname !== 'localhost') {
            pending('shaka-proxy requires localhost')
            return
        }
        if (!window.isSecureContext) {
            pending('requires a secure context')
            return
        }
        if (
            !(
                await player.client.capabilities.supportsKeySystem(
                    DrmKeySystem.WIDEVINE
                )
            ).supported
        ) {
            pending('requires Widevine')
        }
    },
    () => {}
)
