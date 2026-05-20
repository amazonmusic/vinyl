/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Abort,
    AbortError,
    Deferred,
    never,
    withAbort,
} from '@amazon/vinyl-util'
import { flushPromises } from '@amazon/vinyl-util/browserTestUtil'

const error = new Error('test')

describe('withAbort', () => {
    it('rejects if already aborted', async () => {
        const abort = new Abort()
        abort.abort(error)
        const promise = withAbort(never, abort)
        await expectAsync(promise).toBeRejectedWith(error)
    })

    it('rejects if already aborted and promise already resolved', async () => {
        const abort = new Abort()
        abort.abort(error)
        const promise = withAbort(Promise.resolve(1), abort)
        await expectAsync(promise).toBeRejectedWith(error)
    })

    it('rejects if aborted before the promise resolves', async () => {
        const abort = new Abort()
        const promise = withAbort(never, abort)
        await expectAsync(promise).toBePending()
        abort.abort(error)
        await expectAsync(promise).toBeRejectedWith(error)
    })

    it('resolves if promise is resolved before abort', async () => {
        const abort = new Abort()
        const deferred = new Deferred()
        const promise = withAbort(deferred, abort)
        await expectAsync(promise).toBePending()
        deferred.resolve(1)
        await expectAsync(promise).toBeResolvedTo(1)
    })

    it('rejects if promise is rejected before abort', async () => {
        const abort = new Abort()
        const deferred = new Deferred()
        const promise = withAbort(deferred, abort)
        await expectAsync(promise).toBePending()
        const error2 = new Error('error2')
        deferred.reject(error2)
        await flushPromises()
        abort.abort(error)
        await expectAsync(promise).toBeRejectedWith(error2)
    })

    describe('when aborted', () => {
        it('removes abort handlers', async () => {
            const abort = new Abort()
            const deferred = new Deferred()
            const promise = withAbort(deferred, abort)
            abort.abort()
            await expectAsync(promise).toBeRejectedWithError(AbortError)
            expect(abort.hasAnyListeners()).toBeFalse()
        })
    })

    describe('when resolved', () => {
        it('removes abort handlers', async () => {
            const abort = new Abort()
            const promise = withAbort(Promise.resolve(1), abort)
            await expectAsync(promise).toBeResolved()
            expect(abort.hasAnyListeners()).toBeFalse()
        })
    })
})
