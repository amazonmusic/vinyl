/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { nextHasMetadata } from '@amazon/vinyl'
import { MockPlaybackController } from '@amazon/vinyl/vinylTestUtil'
import { Abort } from '@amazon/vinyl-util'

describe('nextHasMetadata', () => {
    let controller: MockPlaybackController
    beforeEach(() => {
        controller = new MockPlaybackController()
    })

    it('resolves when the next HAVE_METADATA event is emitted', async () => {
        const promise = nextHasMetadata(controller)
        await expectAsync(promise).toBePending()
        controller.dispatch('loadedMetadata', {})
        await expectAsync(promise).toBeResolved()
    })

    it('fulfills promise if hasMetadata is already set to true', async () => {
        controller.hasMetadata = false
        await expectAsync(nextHasMetadata(controller)).toBePending()
        controller.hasMetadata = true
        await expectAsync(nextHasMetadata(controller)).toBeResolved()
    })

    it('accepts optional NextEventAsPromiseOptions', async () => {
        const abort = new Abort()
        abort.abort(new Error('reason'))
        await expectAsync(
            nextHasMetadata(controller, {
                abort,
            })
        ).toBeRejectedWithError('reason')
    })
})
