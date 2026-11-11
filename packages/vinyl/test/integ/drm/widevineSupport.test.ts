/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { DrmKeySystem } from '@amazon/vinyl'
import { createVinylSuite, expectsWidevine } from '@amazon/vinyl/vinylTestUtil'

describe('Widevine support', () => {
    const vinylSuite = createVinylSuite()

    beforeEach(() => {
        if (!expectsWidevine())
            pending(`Widevine isn't expected on ${navigator.userAgent}`)
    })

    it('is reported by the key system probe', async () => {
        const support =
            await vinylSuite.player.client.capabilities.supportsKeySystem(
                DrmKeySystem.WIDEVINE
            )
        expect(support.supported)
            .withContext(`Widevine support on ${navigator.userAgent}`)
            .toBeTrue()
    })
})
