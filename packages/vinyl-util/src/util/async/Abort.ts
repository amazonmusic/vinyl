/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { AbortError } from '../../error/AbortError'
import type { ReadonlyEventHost } from '../../event/EventHost'
import { EventHostImpl } from '../../event/EventHost'
import type { Unsubscribe } from '../../core/Unsubscribe'
import { noop } from '../fun/function'

export interface AbortEvent {
    readonly reason: Error
}

export interface AbortEventMap {
    readonly abort: AbortEvent
}

export interface ReadonlyAbort extends ReadonlyEventHost<AbortEventMap> {
    /**
     * True if aborted.
     */
    aborted(): boolean

    /**
     * The reason passed to `abort`.
     */
    readonly reason: Error | null

    /**
     * Throws the signal's abort reason if the signal has been aborted; otherwise it does nothing.
     */
    throwIfAborted(): void

    /**
     * Invokes a callback on 'abort', or immediately if already aborted.
     */
    onAborted(callback: (event: AbortEvent) => void): Unsubscribe

    /**
     * Returns a native signal on supported platforms.
     */
    readonly nativeSignal: AbortSignal | null
}

/**
 * Returns a new native abort controller, if this environment supports AbortController.abort.
 *
 * Supported in Chrome 66+, Edge 16+, Firefox 57+, Opera 53+, Safari 11.3+,
 */
export function createAbortController(): AbortController | null {
    return typeof AbortController === 'undefined' ||
        typeof AbortSignal === 'undefined'
        ? null
        : new AbortController()
}

export interface AbortDeps {
    readonly abortControllerFactory?: () => AbortController | null
}

/**
 * An Abort instance emits an 'abort' event when aborted.
 *
 * A native `AbortController` is encapsulated if the platform supports it, allowing for fetch
 * cancellation.
 */
export class Abort
    extends EventHostImpl<AbortEventMap>
    implements ReadonlyAbort
{
    get [Symbol.toStringTag](): string {
        return 'Abort'
    }

    constructor(private readonly deps?: AbortDeps) {
        super()
    }

    private _reason: Error | null = null

    /**
     * True if this signal is aborted.
     */
    aborted(): boolean {
        return this._reason != null
    }

    /**
     * A JavaScript value providing the abort reason, once this signal has aborted.
     */
    get reason(): Error | null {
        return this._reason
    }

    private _nativeSignal: AbortSignal | null = null

    get nativeSignal(): AbortSignal | null {
        if (!this._nativeSignal) {
            const abortController = (
                this.deps?.abortControllerFactory ?? createAbortController
            )()
            if (!abortController) return null
            if (this.aborted()) {
                abortController.abort(this.reason)
            } else {
                this.on(
                    'abort',
                    (event) => abortController.abort(event.reason),
                    { once: true }
                )
            }
            this._nativeSignal = abortController.signal
        }
        return this._nativeSignal
    }

    /**
     * Throws this signal's abort reason if the signal has been aborted; otherwise it does nothing.
     */
    throwIfAborted(): void {
        if (this.aborted()) throw this.reason!
    }

    /**
     * Invokes a callback on 'abort', or immediately if already aborted.
     */
    onAborted(callback: (event: AbortEvent) => void): Unsubscribe {
        if (this.aborted()) {
            callback({ reason: this.reason! })
            return noop
        } else {
            return this.on('abort', callback)
        }
    }

    /**
     * Sets to the aborted state with the given reason, and emits an 'abort' event.
     * If this signal is already aborted, this will do nothing.
     */
    abort(reason: Error = new AbortError()) {
        if (this.aborted()) return
        this._reason = reason
        this.dispatch('abort', { reason })
    }
}

export interface AbortSlot {
    readonly value: ReadonlyAbort
    abort(reason?: Error): void
}

/**
 * Creates a reusable abort slot that exposes a read-only `Abort` instance.
 *
 * Each call to `abort()` triggers the current `Abort` instance, and then replaces it
 * with a fresh instance for future use. This is useful in systems where cancelable operations
 * are repeatedly started and each one needs its own `Abort` signal.
 *
 * @returns An object with:
 * - `value`: A read-only reference to the current `Abort` instance.
 * - `abort(reason)`: Aborts the current instance with the given reason, then creates a new one.
 *
 * Example:
 * ```ts
 * const slot = createAbortSlot()
 * fetch(url, { signal: slot.value.signal })
 * slot.abort() // aborts current Abort value and prepares a new instance
 * ```
 */
export function createAbortSlot(): AbortSlot {
    let abort = new Abort()

    return {
        get value(): ReadonlyAbort {
            return abort
        },

        abort(reason: Error = new AbortError()): void {
            abort.abort(reason)
            abort = new Abort()
        },
    }
}
