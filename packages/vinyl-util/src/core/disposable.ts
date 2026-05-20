/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IllegalStateError } from '@/error/IllegalStateError'
import type { Unsubscribe } from '@/core/Unsubscribe'
import type { Maybe } from '@/util/type'

/**
 * Any object that may be disposed.
 */
export interface Disposable {
    dispose(): void
}

/**
 * Returns true if the given value is disposable.
 *
 * @param value Any value. The value will be considered Disposable if it contains a method named
 * 'dispose', and that function requires zero parameters. This value will be type guarded to
 * Disposable if true is returned.
 */
export function isDisposable(value: any): value is Disposable {
    return (
        value != null &&
        typeof value.dispose === 'function' &&
        value.dispose.length === 0
    )
}

/**
 * Disposes all the given {@link Disposable} objects.
 *
 * @param disposables
 */
export function disposeAll(disposables: Iterable<Disposable>): void {
    for (const disposable of disposables) {
        disposable.dispose()
    }
}

/**
 * Returns a Disposable that invokes the given function on dispose.
 *
 * @param unsub
 */
export function toDisposable(unsub: () => void): Disposable {
    return { dispose: unsub }
}

export type AddDisposable = <T extends Maybe<Disposable | Unsubscribe>>(
    disposable: T
) => T

/**
 * A Disposer disposes added disposables as a group.
 * The method members may be called without a receiver.
 */
export interface Disposer extends Disposable {
    readonly disposed: boolean
    readonly add: AddDisposable
    readonly dispose: () => void
}

/**
 * Creates a Disposer, an object on which {@link Disposable} instances may be added, and disposed
 * as a group.
 *
 * The method members may be called without a receiver, thus allowing destructuring.
 * Example:
 * ```
 * function create(): Disposable {
 *   const { dispose, add } = disposer()
 *   add(someDisposable)
 *   add(anotherDisposable)
 *   return {
 *     dispose
 *   }
 * }
 * ```
 *
 */
export function createDisposer(): Disposer {
    const disposables: Disposable[] = []
    let _disposed = false
    const add = <T extends Maybe<Unsubscribe | Disposable>>(
        disposableOrUnsub: T
    ): T => {
        if (_disposed) throw new DisposedError()
        if (disposableOrUnsub) {
            disposables.push(
                'dispose' in disposableOrUnsub
                    ? disposableOrUnsub
                    : toDisposable(disposableOrUnsub)
            )
        }
        return disposableOrUnsub
    }
    return {
        dispose() {
            if (_disposed) throw new DisposedError()
            _disposed = true
            disposeAll(disposables)
        },
        add,
        get disposed() {
            return _disposed
        },
    }
}

/**
 * An illegal state error indicating that an object has been disposed.
 */
export class DisposedError extends IllegalStateError {
    get [Symbol.toStringTag](): string {
        return 'DisposedError'
    }

    constructor(message = 'Instance is disposed') {
        super(message)
        Object.setPrototypeOf(this, DisposedError.prototype)
    }
}
