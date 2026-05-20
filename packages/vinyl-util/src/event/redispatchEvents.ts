/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createDisposer } from '@/core/disposable'
import type { EventDispatcher, ReadonlyEventHost } from './EventHost'
import type { Unsubscribe } from '@/core/Unsubscribe'

/**
 * Listens to an event host for a list of events, re-dispatching those events on this target
 * dispatcher.
 * Useful for event delegation.
 *
 * @param dispatcher The dispatcher on which to re-dispatch events.
 * @param eventHost The readonly event host that emits the events to be re-dispatched.
 * @param eventTypes The event types from eventHost to delegate to the dispatcher. These are the
 * keys in the event map that should be delegated.
 * @return Returns a method that when invoked, will unsubscribe from all delegated events.
 */
export function redispatchEvents<EventMap, K extends keyof EventMap>(
    dispatcher: EventDispatcher<Pick<EventMap, K>>,
    eventHost: ReadonlyEventHost<EventMap>,
    eventTypes: readonly K[]
): Unsubscribe {
    const { dispose, add } = createDisposer()
    for (const type of eventTypes) {
        add(eventHost.on(type, (e: any) => dispatcher.dispatch(type, e)))
    }
    return dispose
}
