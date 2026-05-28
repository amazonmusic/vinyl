/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createDisposer,
    type Disposable,
    DisposedError,
} from '../core/disposable'
import type { Unsubscribe } from '../core/Unsubscribe'
import { IllegalArgumentError } from '../error/IllegalArgumentError'
import { EventHostImpl } from '../event/EventHost'
import { emptySignal, type Signal, SignalImpl } from '../event/Signal'
import { logDebug } from '../logging/Logger'
import type { AnyRecord } from '../util/type'
import { createLogPrefix, type LogTarget } from '../logging/LogTarget'

export interface Patch<in T, in EventMap = AnyRecord> extends Disposable {
    /**
     * A signal that emits synthetic events.
     * These events will be dispatched on the proxy, not on the original event target.
     * If undefined, no events are fabricated.
     */
    readonly eventFabricated?: Signal<Event>

    /**
     * Overridden properties.
     */
    readonly properties?: PropertyPatches<T>

    /**
     * Overridden events.
     * Event patches may provide an alternate event to emit, or null to prevent an event from
     * dispatching on the proxy.
     *
     * Note:
     * Patched events have divergent behavior when using Event.stopImmediatePropagation.
     * All handlers added to the patched Proxy will still be called after stopImmediatePropagation.
     * It is the author's opinion that using stopImmediatePropagation is an anti-pattern, and one
     * handler should not be allowed to influence the behavior of neighboring handlers.
     */
    readonly events?: EventPatches<EventMap>
}

/**
 * A record of property key to property patch.
 */
export type PropertyPatches<in T> = {
    readonly [P in keyof T]?: PropertyPatch<T, P>
}

/**
 * An override to a patched property.
 */
export interface PropertyPatch<T, K extends keyof T> {
    /**
     * @return Returns the value to return on the proxy.
     */
    get?(): T[K]

    /**
     * @param newValue The property value attempting to be set.
     */
    set?(newValue: T[K]): void
}

/**
 * Handles an event emitted from the event target. The returned event will be emitted in its
 * place on the proxy.
 *
 * Fabricated events from `eventFabricated` will not be passed to this handler and cannot be
 * squelched.
 *
 * @param event The original event from the event target. This should not be modified
 * directly, but may be cloned and a modified clone may be returned.
 *
 * @return Returns the event to emit on the proxy or null to squelch the event.
 */
export type EventPatch<T> = (event: T) => T | null

/**
 * A record of event type to an event patch.
 */
export type EventPatches<in EventMap> = {
    readonly [P in keyof EventMap]?: EventPatch<EventMap[P]>
}

export type PatchFactory<T, EventMap> = (target: T) => Patch<T, EventMap>

export interface PatchedRef<T> extends Disposable {
    /**
     * The patched target.
     */
    readonly patched: T

    /**
     * A signal for when a synthetic event was fabricated.
     */
    eventFabricated: Signal<Event>

    /**
     * A signal for when an event was squelched.
     */
    eventSquelched: Signal<Event>
}

/**
 * Creates a Proxy for patched event and properties on the target. All patches from the provided
 * factory list will be used in creating a proxy chain. Each patch is applied in order, and
 * patches can rely on their target having been patched with all previous patches.
 *
 * @param target
 * @param patchFactories A list of factories that each produce a new patch for the target.
 * @return Returns a disposable object with a Proxy reference with overridden event and property
 * behavior. When disposed, the event listeners are removed.
 */
export function patchTarget<T extends object, EventMap = AnyRecord>(
    target: T,
    ...patchFactories: PatchFactory<T, EventMap>[]
): PatchedRef<T> {
    const n = patchFactories.length
    if (n === 0) {
        // Not patched
        let disposed = false
        return {
            patched: target,
            eventFabricated: emptySignal,
            eventSquelched: emptySignal,
            dispose: () => {
                // For consistency:
                if (disposed) throw new DisposedError()
                disposed = true
            },
        }
    } else if (n === 1) {
        return _patchTarget(target, patchFactories[0])
    } else {
        const { add, dispose } = createDisposer()
        let patched = target
        const eventFabricated = add(new SignalImpl<Event>())
        const eventSquelched = add(new SignalImpl<Event>())
        const patchedChain: PatchedRef<T>[] = []
        patchFactories.forEach((factory) => {
            const next = patchTarget(patched, factory)
            patched = next.patched
            patchedChain.push(next)
            next.eventFabricated.listen((event) =>
                eventFabricated.dispatch(event)
            )
            next.eventSquelched.listen((event) =>
                eventSquelched.dispatch(event)
            )
        })
        // Patches must be disposed in reverse order
        for (let i = patchedChain.length - 1; i >= 0; i--) {
            add(patchedChain[i])
        }
        return {
            patched,
            eventFabricated,
            eventSquelched,
            dispose,
        }
    }
}

/**
 * Creates a proxy to an event target that can patch properties and events.
 *
 * There are no modifications to the target, the returned proxy should be used in place of the
 * target.
 *
 * @param target
 * @param patchFactory Produces a new patch for the target.
 * @return Returns a disposable object with a Proxy reference with overridden event and property
 * behavior. When disposed, event listeners will be removed and the created patch and proxy will
 * be disposed.
 */
function _patchTarget<T extends object, EventMap>(
    target: T,
    patchFactory: PatchFactory<T, EventMap>
): PatchedRef<T> {
    const { add, dispose } = createDisposer()
    const eventFabricated = add(new SignalImpl<Event>())
    const eventSquelched = add(new SignalImpl<Event>())

    // This method takes a factory instead of the EventTargetPatch directly to ensure that the
    // patch disposal is handled with the proxy disposal.
    const patch = add(patchFactory(target))

    // An event target used in place of the original target for patched events.
    const proxyEventHost = add(new EventHostImpl<Record<string, Event>>())
    patch.eventFabricated?.listen((event) => {
        eventFabricated.dispatch(event)
        proxyEventHost.dispatch(event.type, event)
    })
    const delegatedEvents = new Set<string>()
    const subs = new Map<EventListener, Unsubscribe>()
    let addEventListener: EventTarget['addEventListener'] | undefined =
        undefined
    let removeEventListener: EventTarget['removeEventListener'] | undefined =
        undefined
    if (isEventTarget(target)) {
        if (patch.events || patch.eventFabricated) {
            const eventPatches: EventPatches<any> = patch.events ?? {}
            const observeTargetEvent = (type: string) => {
                if (!delegatedEvents.has(type)) {
                    delegatedEvents.add(type)
                    const targetHandler = (event: Event) => {
                        const patchedEvent =
                            event.type in eventPatches
                                ? eventPatches[event.type]!(event)
                                : event
                        if (patchedEvent)
                            proxyEventHost.dispatch(
                                patchedEvent.type,
                                patchedEvent
                            )
                        else eventSquelched.dispatch(event)
                    }
                    target.addEventListener(type, targetHandler)
                }
            }

            addEventListener = (type, callback: EventListener, options) => {
                if (typeof callback !== 'function')
                    throw new IllegalArgumentError(
                        'only function callbacks are supported'
                    )
                observeTargetEvent(type)
                subs.set(
                    callback,
                    proxyEventHost.on(type, callback, {
                        once:
                            typeof options === 'object'
                                ? (options.once ?? false)
                                : false,
                    })
                )
            }

            removeEventListener = (_, callback) => {
                if (typeof callback !== 'function')
                    throw new IllegalArgumentError(
                        'only function callbacks are supported'
                    )
                const sub = subs.get(callback)
                if (sub) {
                    subs.delete(callback)
                    sub()
                }
            }

            for (const eventPatchesKey in eventPatches) {
                observeTargetEvent(eventPatchesKey)
            }
        } else {
            addEventListener = target.addEventListener.bind(target)
            removeEventListener = target.removeEventListener.bind(target)
        }
    }

    const propertyPatches: PropertyPatches<T> = patch.properties ?? {}

    const patched = new Proxy<T>(target, {
        get(target, p, receiver): any {
            const key = p as keyof T
            if (key === 'addEventListener') {
                return addEventListener
            } else if (key === 'removeEventListener') {
                return removeEventListener
            }
            const patch = propertyPatches[key]
            const value = patch && patch.get ? patch.get() : target[key]
            if (typeof value === 'function') {
                // Redirect the receiver from the Proxy to the target.
                // While it may make more sense to just use the Proxy as the receiver (Liskov
                // substitution principle), HTML DOM methods oddly have checks that enforce that the
                // receiver is strictly the Element.
                return function (this: any, ...args: any[]) {
                    return value.apply(this === receiver ? target : this, args)
                }
            }
            return value
        },

        set(target, p, newValue): boolean {
            const key = p as keyof T
            const patch = propertyPatches[key]
            if (patch && patch.set) patch.set(newValue)
            else target[key] = newValue
            return true
        },
    } as const)

    return {
        patched,

        eventFabricated,
        eventSquelched,

        // Certain supported platforms do not support Proxy.revocable, but this is not a
        // requirement; we do not need to provide a Proxy to a consumer that needs its
        // lifespan controlled.
        dispose,
    }
}

/**
 * Logs debug messages when an event was squelched or fabricated.
 *
 * @param pathTarget
 * @param patched
 * @return Returns a function that when invoked, removes the logging.
 */
export function logPatchedEvents(
    pathTarget: LogTarget,
    patched: PatchedRef<any>
): Unsubscribe {
    const eventSquelchedSub = patched.eventSquelched.listen((event) =>
        logDebug(pathTarget, `'${event.type}' event squelched`)
    )
    const eventFabricatedSub = patched.eventFabricated.listen((event) =>
        logDebug(pathTarget, `'${event.type}' event fabricated`)
    )
    return () => {
        eventSquelchedSub()
        eventFabricatedSub()
    }
}

function isEventTarget(target: AnyRecord): target is EventTarget {
    return 'addEventListener' in target
}

/**
 * A tuple of `[flag, factory]`.
 * Patches will be applied when flag is true.
 */
export type FlagAndPatchEntry<T extends object, EventMap, Key> = readonly [
    flagKey: Key,
    factory: PatchFactory<T, EventMap>,
]

/**
 * Given a list of [flagKey, patchFactory] tuples, patches the target with patches where flag is true.
 */
export function patchTargetFromFlags<T extends object, EventMap, Flags>(
    target: T,
    flags: Flags,
    ...patchEntries: readonly FlagAndPatchEntry<T, EventMap, keyof Flags>[]
): PatchedRef<T> {
    const pathTarget: LogTarget = {
        logPrefix: createLogPrefix('Patch'),
    }
    const filtered = patchEntries.filter(([key]) => {
        const enabled = flags[key] === true
        if (enabled) logDebug(pathTarget, `Applying '${String(key)}' patch`)
        return enabled
    })
    const patchedRef = patchTarget(
        target,
        ...filtered.map(([_, factory]) => factory)
    )
    // Logs fabricated and squelched events.
    logPatchedEvents(pathTarget, patchedRef)
    return patchedRef
}
