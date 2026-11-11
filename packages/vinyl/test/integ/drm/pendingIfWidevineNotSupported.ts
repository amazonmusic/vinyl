/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VinylPlayer } from '@amazon/vinyl'
import { DrmKeySystem } from '@amazon/vinyl'
import { expectsWidevine } from '@amazon/vinyl/vinylTestUtil'
import { memoize } from '@amazon/vinyl-util'

/**
 * Probes Widevine support once; support is a property of the browser, not the
 * player.
 */
const supportsWidevine = memoize(
    async (player: VinylPlayer): Promise<boolean> =>
        (
            await player.client.capabilities.supportsKeySystem(
                DrmKeySystem.WIDEVINE
            )
        ).supported,
    () => {}
)

/**
 * Marks the spec as pending if Widevine is not supported, returning true. Throws
 * instead, failing the spec, if the browser is one {@link expectsWidevine}, so a
 * broken probe can't silently skip every Widevine spec.
 *
 * @param player
 */
export async function pendingIfWidevineNotSupported(
    player: VinylPlayer
): Promise<boolean> {
    if (await supportsWidevine(player)) return false
    if (expectsWidevine())
        throw new Error(
            `Widevine is expected to be supported on ${navigator.userAgent}, but the key system probe reports it unsupported.`
        )
    pending('requires Widevine')
    return true
}
