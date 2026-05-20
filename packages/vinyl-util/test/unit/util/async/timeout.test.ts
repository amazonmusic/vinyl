/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Abort,
    sleep,
    timeout,
    TimeoutError,
    withTimeout,
} from '@amazon/vinyl-util'
import { useMockTime } from '@amazon/vinyl-util/browserTestUtil'

describe('withTimeout', () => {
    const clock = useMockTime()

    it('rejects if timeout has elapsed before wrapped promise resolves', async () => {
        const promise = (async () => {
            await sleep(20.0)
            throw new Error('fail')
        })()
        const expectation = expectAsync(
            withTimeout(promise, 10)
        ).toBeRejectedWithError(TimeoutError)
        await clock.tick(10, 10)
        await expectation
    })

    it('rejects if timeout has elapsed before wrapped promise rejects', async () => {
        const expectation = expectAsync(
            withTimeout(sleep(20.0), 10)
        ).toBeRejectedWithError(TimeoutError, 'Timed out after 10s')
        await clock.tick(10, 10)
        await expectation
    })

    it('uses the provided message for the timeout error', async () => {
        const expectation = expectAsync(
            withTimeout(sleep(20.0), 10, 'erred in {time}s')
        ).toBeRejectedWithError(TimeoutError, 'erred in 10s')
        await clock.tick(10, 10)
        await expectation
    })

    it('resolves if wrapped promise resolves before timeout', async () => {
        const promise = (async () => {
            await sleep(10.0)
            return 'pass'
        })()
        const expectation = expectAsync(
            withTimeout(promise, 20)
        ).toBeResolvedTo('pass')
        await clock.tick(10, 10)
        await expectation
    })

    it('rejects with wrapped reason if wrapped promise rejects before timeout', async () => {
        const error = new Error('fail')
        const promise = (async () => {
            await sleep(10.0)
            throw error
        })()
        const expectation = expectAsync(
            withTimeout(promise, 20)
        ).toBeRejectedWith(error)
        await clock.tick(10, 10)
        await expectation
    })

    it('does not have a timeout if time is undefined', () => {
        const inner = Promise.resolve(1)
        const promise = withTimeout(inner)
        expect(promise === inner).toBeTrue()
    })
})

describe('timeout', () => {
    const clock = useMockTime()

    it('rejects after the given time', async () => {
        const promise = timeout(1000)
        await clock.tick(990.0)
        await expectAsync(promise).toBePending()
        await clock.tick(10.0)
        await expectAsync(promise).toBeRejectedWithError(TimeoutError)
    })

    it('resolves if a provided abort signal is aborted', async () => {
        const abort = new Abort()
        const promise = timeout(1000, abort)
        await clock.tick(500.0)
        abort.abort()
        await expectAsync(promise).toBeResolvedTo(void 0)
    })
})
