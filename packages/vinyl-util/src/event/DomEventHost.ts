/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Disposable } from '../core/disposable'
import type { ReadonlyEventHost } from './EventHost'
import type { EventHandler, SignalOptions } from './Signal'
import type { Unsubscribe } from '../core/Unsubscribe'
import { remove } from '../util/collection/array'
import type { ExtractValues } from '../util/type'
import { covariant } from '../util/type'

/**
 * Picks the keys from T that satisfy: `[keyof T extends string]: Event`
 */
export type DomEventMap<T> = ExtractValues<Pick<T, keyof T & string>, Event>

export interface DomReadonlyEventHost<EventMap> extends ReadonlyEventHost<
    DomEventMap<EventMap>
> {
    /**
     * Adds an event handler for the given typed event.
     *
     * @param type A case-sensitive string representing the event type to listen for.
     * @param handler A callback to invoke when the event with the given type is dispatched.
     * @param options An options object specifies characteristics about the event listener.
     * @return Returns a method, when invoked, removes the handler.
     */
    on<K extends keyof DomEventMap<EventMap>>(
        type: K,
        handler: EventHandler<DomEventMap<EventMap>[K]>,
        options?: DomEventListenerOptions
    ): Unsubscribe
}

/**
 * Event listener options for DOM events.
 *
 * Note: signal not supported, use abort utilities.
 */
export interface DomEventListenerOptions
    extends SignalOptions, Omit<AddEventListenerOptions, 'signal'> {}

/**
 * Wraps a js `EventTarget` with a {@link ReadonlyEventHost} interface.
 */
export class DomEventHost<EventMap>
    implements DomReadonlyEventHost<EventMap>, Disposable
{
    private activeSubs: Unsubscribe[] = []
    private listenerCounts: {
        [P in keyof EventMap]?: number
    } = {}

    constructor(protected readonly eventTarget: EventTarget) {}

    hasAnyListeners(): boolean {
        return this.activeSubs.length > 0
    }

    hasListeners(type: keyof DomEventMap<EventMap>): boolean {
        return (this.listenerCounts[type] ?? 0) > 0
    }

    on<K extends keyof DomEventMap<EventMap>>(
        type: K,
        handler: EventHandler<DomEventMap<EventMap>[K]>,
        options?: DomEventListenerOptions
    ): Unsubscribe {
        this.listenerCounts[type] = (this.listenerCounts[type] ?? 0) + 1
        // If options.once is true, wrap the callback in order to decrement listener counts and
        // remove the tracked subscription. Otherwise, the callback can be used directly.
        const eventListener: EventListener = options?.once
            ? (event: Event) => {
                  handler(event as DomEventMap<EventMap>[K])
                  unsub()
              }
            : (handler as EventListener)
        const unsub = () => {
            remove(this.activeSubs, unsub)
            this.listenerCounts[type]!--
            this.eventTarget.removeEventListener(type, eventListener, options)
        }
        this.eventTarget.addEventListener(type, eventListener, options)
        this.activeSubs.push(unsub)
        return unsub
    }

    /**
     * Disposal of a DomEventHost removes all listeners.
     */
    dispose() {
        for (let i = this.activeSubs.length - 1; i >= 0; i--) {
            // unsubscribing will remove the element from activeSubs, iterating in reverse
            // keeps the cursor correct.
            this.activeSubs[i]()
        }
    }

    __eventMapType = covariant<EventMap>()
}
