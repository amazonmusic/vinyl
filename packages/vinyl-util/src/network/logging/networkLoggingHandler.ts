/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Disposable } from '@/core/disposable'
import { createDisposer } from '@/core/disposable'
import type { ReadonlyEventHost } from '@/event/EventHost'
import { logDebug } from '@/logging/Logger'
import type {
    RequestAttemptStartEvent,
    RequestCompletedEvent,
    RequesterImplEventMap,
} from '@/network/RequesterImplEventMap'
import { truncate } from '@/util/string/string'
import { createLogPrefix, type LogTarget } from '@/logging/LogTarget'

/**
 * The max length to truncate the logged service id.
 * @private
 */
const SERVICE_ID_TRUNC = 20

/**
 * Logs all network events.
 *
 * @param requester The event host with request events to observe.
 * @return Returns a disposable handle to remove all added handlers.
 */
export function networkLoggingHandler(
    requester: ReadonlyEventHost<RequesterImplEventMap>
): Disposable & { readonly target: LogTarget } {
    const { dispose, add } = createDisposer()
    const target: LogTarget = {
        logPrefix: createLogPrefix('Network'),
    }
    add(
        requester.on(
            'requestAttemptStart',
            (event: RequestAttemptStartEvent) => {
                const url = getInputUrl(event.requestInfo.input)
                logDebug(
                    target,
                    'requestAttemptStart',
                    truncate(
                        event.requestInfo.requestOptions.serviceId,
                        SERVICE_ID_TRUNC
                    ),
                    {
                        requestInfo: {
                            url,
                            requestId: event.requestInfo.requestId,
                            maxRetries: event.requestInfo.maxRetries,
                            requestOptions: event.requestInfo.requestOptions,
                            timestamp: event.requestInfo.timestamp,
                        },
                        attemptInfo: event.attemptInfo,
                    }
                )
            }
        )
    )
    add(
        requester.on(
            'requestAttemptComplete',
            (event: RequestCompletedEvent) => {
                const url = getInputUrl(event.requestInfo.input)
                logDebug(
                    target,
                    'requestAttemptComplete',
                    truncate(
                        event.requestInfo.requestOptions.serviceId,
                        SERVICE_ID_TRUNC
                    ),
                    {
                        ok: event.ok,
                        timestamp: event.timestamp,
                        durationMs:
                            event.timestamp - event.requestInfo.timestamp,
                        requestInfo: {
                            url,
                            requestId: event.requestInfo.requestId,
                            maxRetries: event.requestInfo.maxRetries,
                            requestOptions: event.requestInfo.requestOptions,
                            timestamp: event.requestInfo.timestamp,
                        },
                    }
                )
            }
        )
    )
    return {
        target,
        dispose,
    }
}

/**
 * Returns the URL string of the request.
 * @param input
 */
function getInputUrl(input: RequestInfo | URL): string {
    let url: string | null
    if (input instanceof URL) {
        url = input.toString()
    } else if (typeof input === 'string') {
        url = input
    } else {
        url = input.url
    }
    return url
}
