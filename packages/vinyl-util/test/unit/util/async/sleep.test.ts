/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Abort, AbortError, sleep } from '@amazon/vinyl-util'
import { useMockTime } from '@amazon/vinyl-util/browserTestUtil'

describe('sleep', () => {
    const clock = useMockTime()

    it('resolves after n seconds', async () => {
        const promise = sleep(1000.0)
        await clock.tick(900.0)
        await expectAsync(promise).toBePending()
        await clock.tick(100.0)
        await expectAsync(promise).toBeResolved()
    })

    it('can be aborted', async () => {
        const abort = new Abort()
        const promise = sleep(1000.0, abort)
        await expectAsync(promise).toBePending()
        const error = new Error('reason1')
        abort.abort(error)
        await expectAsync(promise).toBeRejectedWith(error)
    })

    it('rejects immediately if already aborted', async () => {
        const abort = new Abort()
        abort.abort()
        await expectAsync(sleep(1000.0, abort)).toBeRejectedWith(
            new AbortError()
        )
    })

    describe('when time is <= 0', () => {
        describe('and aborted', () => {
            it('rejects', async () => {
                const abort = new Abort()
                abort.abort()
                await expectAsync(sleep(0, abort)).toBeRejectedWith(
                    new AbortError()
                )
            })
        })
        describe('and not aborted', () => {
            it('resolves', async () => {
                await expectAsync(sleep(0.0)).toBeResolvedTo(void 0)
                await expectAsync(sleep(-2)).toBeResolvedTo(void 0)
            })
        })
    })
})
