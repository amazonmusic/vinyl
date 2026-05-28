/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Disposable } from '../../core/disposable'
import { DisposedError, isDisposable } from '../../core/disposable'
import { IllegalStateError } from '../../error/IllegalStateError'

export interface ReadonlyLazy<T> {
    /**
     * True if the lazy instance has been constructed.
     */
    readonly constructed: boolean

    /**
     * When invoked the first time, constructs the value and returns it.
     * Consecutive calls will return that cached value.
     * @throws DisposedError If this lazy factory is disposed.
     */
    get value(): T
}

export interface Lazy<T> extends ReadonlyLazy<T>, Disposable {
    /**
     * Sets the lazy instance's value.
     * If disposed, a {@link DisposedError} will be thrown.
     * @param value
     */
    set value(value: T)

    /**
     * Clears the lazy instance, disposing its value.
     * Unlike dispose(), this allows the lazy instance to be reconstructed upon the next get.
     * Typically used only in unit testing. May be used after {@link dispose}.
     */
    clear(): void
}

/**
 * A factory to lazily instantiate a single cached instance.
 */
export class LazyImpl<T> implements Lazy<T>, Disposable {
    private _constructing = false
    private _constructed = false
    private disposed = false
    private _value: T | undefined = undefined

    /**
     * @param factory A factory function that will be invoked at most once.
     */
    constructor(private readonly factory: () => T) {}

    get constructed(): boolean {
        return this._constructed
    }

    get value(): T {
        if (this.disposed) throw new DisposedError()
        if (this._constructing)
            throw new IllegalStateError('Lazy instance is constructing')
        if (this._constructed) return this._value as T
        this._constructing = true
        this._value = this.factory()
        this._constructing = false
        this._constructed = true
        return this._value
    }

    set value(value: T) {
        if (this.disposed) throw new DisposedError()
        this.clear()
        this._constructed = true
        this._value = value
    }

    clear(): void {
        this.disposed = false
        if (this._constructed) {
            if (isDisposable(this._value)) {
                this._value.dispose()
            }
            this._constructed = false
            this._value = undefined
        }
    }

    dispose() {
        if (this.disposed) throw new DisposedError()
        this.clear()
        this.disposed = true
    }
}

/**
 * Creates a new {@link Lazy} instance.
 *
 * @param factory A factory function that will be invoked at most once. If the instance produced
 * is disposable, it will be disposed on clear.
 */
export function lazy<T>(factory: () => T): Lazy<T> {
    return new LazyImpl<T>(factory)
}
