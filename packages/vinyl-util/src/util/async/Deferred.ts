/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A Deferred object is a Promise with public methods to resolve and reject.
 *
 * Example:
 *
 * ```
 *  const deferred = new Deferred<number>()
 *  setTimeout(() => {
 *      deferred.resolve(42)
 *  }, 1000)
 *
 *  deferred.then(value => console.log('Resolved to:', value))
 * ```
 */
export class Deferred<T> implements Promise<T> {
    private readonly promise: Promise<T>
    resolve!: (value: T | PromiseLike<T>) => void
    reject!: (reason?: any) => void

    constructor() {
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = resolve
            this.reject = reject
        })
    }

    catch<TResult = never>(
        onrejected?: ((reason: any) => PromiseLike<TResult> | TResult) | null
    ): Promise<T | TResult> {
        return this.promise.catch(onrejected)
    }

    then<TResult1 = T, TResult2 = never>(
        onfulfilled?: ((value: T) => PromiseLike<TResult1> | TResult1) | null,
        onrejected?: ((reason: any) => PromiseLike<TResult2> | TResult2) | null
    ): Promise<TResult1 | TResult2> {
        return this.promise.then(onfulfilled, onrejected)
    }

    finally(onfinally?: (() => void) | null): Promise<T> {
        return this.promise.finally(onfinally)
    }

    get [Symbol.toStringTag](): string {
        return this.promise[Symbol.toStringTag]
    }
}
