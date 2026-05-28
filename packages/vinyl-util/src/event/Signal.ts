/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Disposable } from '../core/disposable'
import type { Unsubscribe } from '../core/Unsubscribe'
import { LinkedList } from '../util/collection/LinkedList'

export type EventHandler<in T> = (event: T) => void

export interface SignalOptions {
    /**
     * If true, removes the handler after the first invocation.
     */
    once?: boolean
}

export interface Signal<T> {
    /**
     * Returns true if this signal has no handlers.
     */
    readonly empty: boolean

    /**
     * Adds an event handler that will be invoked upon signal dispatch.
     *
     * @param handler The handler to invoke on signal dispatch.
     * @param options Options for changing listening behavior.
     * @return Unsubscribe - Returns a method where, when invoked, will remove the handler.
     * If the handler has already been removed, Unsubscribe will do nothing.
     */
    listen(handler: EventHandler<T>, options?: SignalOptions): Unsubscribe
}

/**
 * An object that may dispatch one type of event and have handlers for that event.
 */
export class SignalImpl<T> implements Signal<T>, Disposable {
    private handlers = new LinkedList<EventHandler<any>>()

    get empty(): boolean {
        return this.handlers.empty
    }

    listen(handler: EventHandler<T>, options?: SignalOptions): Unsubscribe {
        const remove = () => this.handlers.remove(node)
        const node = this.handlers.push(
            options?.once
                ? (event) => {
                      remove()
                      handler(event)
                  }
                : handler
        )
        return remove
    }

    /**
     * Invokes all handlers, providing the given event.
     *
     * Handlers may add/remove callbacks or do a nested dispatch.
     *
     * If a handler is added within a handler, the new handler will not be invoked until the
     * next dispatch.
     *
     * @param event
     */
    dispatch(event: T): void {
        const handlers = this.handlers
        const tail = handlers.tail
        handlers.some((handler) => {
            handler(event)
            return handler === tail!.value
        })
    }

    /**
     * Removes all handlers.
     */
    clear(): void {
        this.handlers.clear()
    }

    /**
     * Same as clear.
     */
    dispose(): void {
        this.clear()
    }
}

/**
 * Constructs a new SignalImpl.
 */
export function signal<T>(): SignalImpl<T> {
    return new SignalImpl<T>()
}

export const emptySignal: Signal<any> = {
    empty: true,

    listen(): Unsubscribe {
        return () => {}
    },
}
