/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    Disposable,
    EventHandler,
    Fun,
    ReadonlyEventHost,
} from '@amazon/vinyl-util'
import { Deferred, substitute, withTimeout } from '@amazon/vinyl-util'
import createSpy = jasmine.createSpy
import Spy = jasmine.Spy

/**
 * A Spy that provides a way to promisify the next call and unsubscribe.
 *
 * Do not use `and` on an EventSpy, the callFake is used to provide the next promise.
 */
export interface EventSpy<EventMap, K extends keyof EventMap>
    extends Spy<EventHandler<EventMap[K]>>, Fun, Disposable {
    /**
     * Returns a promise that resolves when the event has next been dispatched, or rejects
     * if timeout has elapsed.
     *
     * @param timeout The number of seconds before a timeout.
     * @param timeoutMessage An optional timeout message to use instead of the default.
     *  This may use two tokens:
     *   {0} - The event type.
     *   {1} - Number of seconds before the timeout.
     */
    next(timeout?: number, timeoutMessage?: string): Promise<EventMap[K]>
}

/**
 * Adds a listener to an event host, returning a spy for assertions.
 *
 * The returned spy provides a `next` function to promisify the next call and a `dispose` function
 * to unsubscribe.
 *
 * @param host
 * @param type
 */
export function createEventSpy<EventMap, K extends keyof EventMap>(
    host: ReadonlyEventHost<EventMap>,
    type: K
): EventSpy<EventMap, K> {
    const spy = createSpy(String(type))
    let nextCall = new Deferred<EventMap[K]>()
    spy.and.callFake(() => {
        nextCall.resolve(spy.calls.mostRecent().args[0])
        nextCall = new Deferred<EventMap[K]>()
    })
    const unsub = host.on(type, spy)

    return Object.assign(spy, {
        next(
            timeout = 5,
            timeoutMessage = `event '{type}' has not been dispatched after {timeout}s.`
        ) {
            return withTimeout(
                nextCall,
                timeout,
                substitute(timeoutMessage, {
                    type,
                    timeout,
                })
            )
        },
        dispose: unsub,
    })
}
