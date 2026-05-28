/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReadonlyEventHost } from './EventHost'
import type { ReadonlyAbort } from '../util/async/Abort'
import { promise } from '../util/async/promise'
import { withTimeout } from '../util/async/timeout'
import type { Maybe } from '../util/type'

export interface NextEventAsPromiseOptions<EventMap, K extends keyof EventMap> {
    /**
     * (Optional) If provided, will only resolve if the event passes this predicate.
     */
    filter?: ((event: EventMap[K]) => boolean) | undefined | null

    /**
     * (Optional) If provided, will reject the promise if the signal is aborted.
     */
    abort?: Maybe<ReadonlyAbort>

    /**
     * If provided, the promise will reject after this duration, in seconds, if not resolved.
     */
    timeout?: number

    /**
     * The timeout message. If not provided will use `DEFAULT_TIMEOUT_MESSAGE`.
     */
    timeoutMessage?: string
}

/**
 * Promisifies the next event.
 *
 * @param host The event host to observe.
 * @param type The name of the event.
 * @param options Optional configuration, to provide abort
 */
export function nextEventAsPromise<EventMap, K extends keyof EventMap>(
    host: ReadonlyEventHost<EventMap>,
    type: K,
    options?: Maybe<NextEventAsPromiseOptions<EventMap, K>>
): Promise<EventMap[K]> {
    return withTimeout(
        promise((resolve) => {
            return host.on(type, (event: EventMap[K]) => {
                if (!options?.filter || options.filter(event)) {
                    resolve(event)
                }
            })
        }, options?.abort),
        options?.timeout,
        options?.timeoutMessage ??
            `Event '${String(type)}' was not received within {time}s`
    )
}
