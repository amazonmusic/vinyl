/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Unsubscribe } from '@/core/Unsubscribe'
import { Abort, type ReadonlyAbort } from './Abort'
import { Deferred } from './Deferred'
import type { Maybe } from '@/util/type'
import { type Disposable, DisposedError, isDisposable } from '@/core/disposable'
import { withAbort } from '@/util/async/abortUtils'

/**
 * Creates a promise that can be rejected early from an abort signal and can optionally provide
 * cleanup handling when the promise is settled.
 *
 * Common cases that require clean-up would be promises based on event listeners that must be
 * removed, or timers that need to be cleared.
 *
 * Promises are always expected to settle. They cannot be canceled, but they can be rejected.
 * This promise wrapper can be given an {@link ReadonlyAbort} object which rejects the promise
 * if abort is emitted before the promise settles.
 *
 * @param executor A method that will be invoked at most once immediately with two arguments,
 * `resolve` and `reject`. `resolve` must be called when the promise should be resolved, reject
 * may be called if the promise should be rejected. An optional function may be returned that
 * performs any cleanup necessary when the promise settles. This is called immediately before
 * resolve or reject. The executor may not be invoked if the abortSignal is already in an
 * aborted state.
 * @param abort If provided, will reject the returned promise with the signal's abort
 * reason when aborted.
 */
export function promise<T>(
    executor: (
        resolve: (value: T | PromiseLike<T>) => void,
        reject: (reason?: any) => void
    ) => Unsubscribe | void,
    abort?: Maybe<ReadonlyAbort>
): Promise<T> {
    if (abort?.aborted()) return Promise.reject(abort.reason!)

    const deferred = new Deferred<T>()
    let resolved = false
    let resolvedTo: T | PromiseLike<T> | undefined = undefined
    let rejected = false
    let rejectionReason: any = undefined

    const abortSub = abort?.on('abort', (e) => reject(e.reason), {
        once: true,
    })

    function settled(): boolean {
        return resolved || rejected
    }

    function complete() {
        if (resolved) {
            deferred.resolve(resolvedTo!)
        } else {
            deferred.reject(rejectionReason)
        }
        if (unsub) unsub()
        if (abortSub) abortSub()
    }

    function resolve(value: T | PromiseLike<T>) {
        if (settled()) return
        resolved = true
        resolvedTo = value
        if (initialized) complete()
    }

    function reject(reason: any) {
        if (settled()) return
        rejected = true
        rejectionReason = reason
        if (initialized) complete()
    }

    let initialized = false
    const unsub = executor(resolve, reject)
    initialized = true
    if (settled()) complete()
    return deferred
}

/**
 * Determines whether a value implements the `PromiseLike<T>` interface.
 *
 * This function checks if the given value is a non-null object with a `then` method,
 * which is the structural requirement for `PromiseLike` in TypeScript.
 *
 * @typeParam T - The type the promise resolves to (optional, used for type narrowing).
 * @param value - The value to check.
 * @returns `true` if the value is `PromiseLike<T>`, otherwise `false`.
 *
 * @example
 * ```ts
 * const maybePromise: unknown = Promise.resolve(42)
 * if (isPromiseLike(maybePromise)) {
 *   maybePromise.then(value => console.log(value)) // value is type-safe
 * }
 * ```
 */
export function isPromiseLike<T = any>(
    value: unknown
): value is PromiseLike<T> {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as any).then === 'function'
    )
}

/**
 * Wraps a `PromiseLike<Disposable>` with a `Disposable` interface.
 * Disposing will abort the operation and dispose the resolved value (if/when it resolves).
 *
 * @param promise - A Promise-like object that resolves to a `Disposable`
 * @returns An object that implements both `PromiseLike<T>` and `Disposable`
 */
export function toDisposablePromise<T extends PromiseLike<any>>(
    promise: T
): T & Disposable {
    const abort = new Abort()
    let disposed = false
    let resolved: Disposable | null = null

    const wrapped = withAbort(
        new Promise((resolve, reject) => {
            promise.then(
                (result) => {
                    resolved = result
                    if (disposed && isDisposable(result)) {
                        result.dispose()
                    }
                    resolve(result)
                },
                (err: Error) => reject(err)
            )
        }),
        abort
    ) as unknown as T & Disposable

    wrapped.dispose = () => {
        if (disposed) throw new DisposedError()
        disposed = true
        abort.abort()
        if (isDisposable(resolved)) {
            resolved.dispose()
        }
    }

    return wrapped
}
