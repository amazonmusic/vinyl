/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Disposable } from '@/core/disposable'
import type { EventHandler, SignalImpl, SignalOptions } from './Signal'
import { signal } from './Signal'
import type { Unsubscribe } from '@/core/Unsubscribe'
import { getOrSet } from '@/util/map/map'
import type { Covariant } from '@/util/type'
import { covariant } from '@/util/type'
import { createLogPrefix, type LogTarget } from '@/logging/LogTarget'

export interface EventDispatcher<in EventMap> extends LogTarget {
    /**
     * Dispatches an event.
     *
     * @param type The key of the event within `EventMap`
     * @param event If the passed event is read-only, then it may be re-used/cached. Otherwise,
     * it should be a new event object every dispatch. If no target property is set on the event,
     * the target will be set to this host.
     */
    dispatch<K extends keyof EventMap>(type: K, event: EventMap[K]): void
}

export interface ReadonlyEventHost<out EventMap> {
    /**
     * Adds an event handler for the given typed event.
     *
     * @param type The key representing the event type to listen for.
     * @param handler A callback to invoke when the event with the given type is dispatched.
     * @param options Options for changing listening behavior.
     * @return Returns a method, when invoked, removes the handler.
     */
    on<K extends keyof EventMap>(
        type: K,
        handler: EventHandler<EventMap[K]>,
        options?: SignalOptions
    ): Unsubscribe

    /**
     * Returns true if the event host has any listeners.
     */
    hasAnyListeners(): boolean

    /**
     * Returns true if the event host has any listeners for the given type.
     */
    hasListeners(type: keyof EventMap): boolean

    /**
     * Exists for EventMap type inference.
     *
     * @private
     */
    __eventMapType: Covariant<EventMap>
}

/**
 * An object that may dispatch events and have handlers for those events.
 * Similar to the DOM's `EventTarget`, this is a basic event system based on event naming.
 *
 * Some of the advantages of EventHost over EventTarget:
 * - Not all supported platforms support EventTarget construction or extension.
 * - EventTarget is designed for the DOM, with bubble and capture phases not necessary in Vinyl.
 * - Event types are strict.
 * - Events can be plain objects, no need to extend CustomEvent.
 * - Easier unsubscription and disposal; reduces the risk of memory leaks.
 *
 * EventHost supports concurrent modification, that is, handlers may be added or removed during
 * the execution of another handler.
 */
export interface EventHost<EventMap>
    extends ReadonlyEventHost<EventMap>, EventDispatcher<EventMap> {}

export class EventHostImpl<EventMap>
    implements EventHost<EventMap>, Disposable
{
    get [Symbol.toStringTag](): string {
        return 'EventHostImpl'
    }

    readonly logPrefix = createLogPrefix(this)

    private readonly signals = new Map<keyof EventMap, SignalImpl<any>>()

    hasAnyListeners(): boolean {
        for (const value of this.signals.values()) {
            if (!value.empty) return true
        }
        return false
    }

    hasListeners(type: keyof EventMap): boolean {
        return this.signals.get(type)?.empty === false
    }

    on<K extends keyof EventMap>(
        type: K,
        handler: EventHandler<EventMap[K]>,
        options?: SignalOptions
    ): Unsubscribe {
        const sig = getOrSet(this.signals, type, () => signal<any>())
        return sig.listen(handler, options)
    }

    dispatch<K extends keyof EventMap>(type: K, event: EventMap[K]): void {
        this.signals.get(type)?.dispatch(event)
    }

    dispose(): void {
        for (const signal of this.signals.values()) signal.dispose()
        this.signals.clear()
    }

    __eventMapType = covariant<EventMap>()
}
