/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createDisposer } from '../core/disposable'
import type { Unsubscribe } from '../core/Unsubscribe'
import type { ReadonlyEventHost } from './EventHost'
import type { SignalOptions } from './Signal'

/**
 * Adds a single handler to all given event types on an event host.
 *
 * @param host The event host.
 * @param types An array of event types.
 * @param handler A handler to be called if any of the given event types are dispatched.
 * @param options If once is true, the first event called will remove the handler.
 */
export function onAny<EventMap, K extends keyof EventMap>(
    host: ReadonlyEventHost<EventMap>,
    types: readonly K[],
    handler: <U extends K>(event: EventMap[U], type: U) => void,
    options?: SignalOptions
): Unsubscribe {
    const { dispose, add } = createDisposer()
    for (const type of types) {
        add(
            host.on(type, (e) => {
                if (options?.once) dispose()
                handler(e, type)
            })
        )
    }
    return dispose
}
