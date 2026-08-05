/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Abort, poll } from '@amazon/vinyl-util'
import { useMockTime } from '@amazon/vinyl-util/browserTestUtil'

describe('poll', () => {
    const clock = useMockTime()

    it('resolves true immediately when the predicate is already true', async () => {
        await expectAsync(poll(() => true)).toBeResolvedTo(true)
    })

    it('does not evaluate the predicate again after it becomes true', async () => {
        // A predicate that is true exactly once (the evaluation that ends the
        // loop) and false on any later call. poll must return the value that
        // ended the loop, not a stale re-evaluation.
        let calls = 0
        const promise = poll(() => ++calls === 2)
        await clock.tick(0.05)
        await expectAsync(promise).toBeResolvedTo(true)
        expect(calls).toBe(2)
    })

    it('resolves true once the predicate becomes true', async () => {
        let ready = false
        const promise = poll(() => ready, { timeout: 30 })
        await expectAsync(promise).toBePending()
        ready = true
        await clock.tick(0.05)
        await expectAsync(promise).toBeResolvedTo(true)
    })

    it('resolves false when the timeout elapses', async () => {
        const promise = poll(() => false, { timeout: 0.1 })
        await expectAsync(promise).toBePending()
        await clock.tick(0.05, 0.05)
        await expectAsync(promise).toBeResolvedTo(false)
    })

    it('polls indefinitely when no timeout is given', async () => {
        let ready = false
        const promise = poll(() => ready)
        // Far longer than any default timeout — still pending without a timeout.
        await clock.tick(...new Array<number>(1000).fill(1))
        await expectAsync(promise).toBePending()
        ready = true
        await clock.tick(0.05)
        await expectAsync(promise).toBeResolvedTo(true)
    })

    it('re-evaluates on the given pollInterval', async () => {
        let calls = 0
        const promise = poll(() => ++calls >= 3, { pollInterval: 5 })
        await clock.tick(5) // second evaluation
        await expectAsync(promise).toBePending()
        await clock.tick(5) // third evaluation -> true
        await expectAsync(promise).toBeResolvedTo(true)
        expect(calls).toBe(3)
    })

    describe('when aborted', () => {
        it('rejects with the abort reason', async () => {
            const abort = new Abort()
            const promise = poll(() => false, { timeout: 30, abort })
            await expectAsync(promise).toBePending()
            const error = new Error('stop polling')
            abort.abort(error)
            await clock.tick()
            await expectAsync(promise).toBeRejectedWith(error)
        })
    })
})
