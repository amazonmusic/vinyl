/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimeoutError } from '../../error/TimeoutError'
import type { ReadonlyAbort } from './Abort'
import { Abort } from './Abort'
import { sleep } from './sleep'
import { substitute } from '../string/string'
import { ErrorOrigin } from '../../error/ErrorOrigin'
import { ErrorLevel } from '../../error/ReportableError'

export const DEFAULT_TIMEOUT_MESSAGE = 'Timed out after {time}s'

/**
 * Options for {@link withTimeout}.
 */
export interface WithTimeoutOptions {
    /**
     * The message to set in the {@link TimeoutError}. Uses `{time}` token.
     * (default: {@link DEFAULT_TIMEOUT_MESSAGE})
     */
    readonly message?: string | undefined

    /**
     * The error origin. (default: `ErrorOrigin.INTERNAL`)
     */
    readonly origin?: string | undefined

    /**
     * The error level. (default: `ErrorLevel.FATAL`)
     */
    readonly level?: ErrorLevel | undefined
}

/**
 * Races a promise with a timeout, rejecting with a {@link TimeoutError} if the timeout is
 * reached before the provided promise.
 *
 * @param promise The promise to race against a timeout.
 * @param time The number of seconds to wait. If undefined, the promise is returned without
 * wrapping.
 * @param options Timeout error options (message, origin, level).
 */
export function withTimeout<T>(
    promise: PromiseLike<T>,
    time?: number,
    options: WithTimeoutOptions = {}
): Promise<T> {
    const {
        message = DEFAULT_TIMEOUT_MESSAGE,
        origin = ErrorOrigin.INTERNAL,
        level = ErrorLevel.FATAL,
    } = options
    if (time === undefined) return Promise.resolve(promise)
    const abort = new Abort()
    return Promise.race([
        promise,
        timeout(time, { abort, message, origin, level }),
    ]).then(() => {
        abort.abort()
        return promise
    })
}

/**
 * Options for {@link timeout}.
 */
export interface TimeoutOptions extends WithTimeoutOptions {
    /**
     * If provided, when aborted (regardless of reason) will resolve the
     * returned promise rather than rejecting.
     */
    readonly abort?: ReadonlyAbort | undefined
}

/**
 * Returns a promise that will reject after the provided number of seconds.
 * If the optional abort signal is aborted, the timer will be canceled and the promise resolved.
 * This is the inverse of {@link sleep}
 *
 * @param time The number of seconds to wait.
 * @param options Timeout options (abort, message, origin, level).
 */
export function timeout(
    time: number,
    options: TimeoutOptions = {}
): Promise<void> {
    const {
        abort,
        message = DEFAULT_TIMEOUT_MESSAGE,
        origin = ErrorOrigin.INTERNAL,
        level = ErrorLevel.FATAL,
    } = options
    return new Promise((resolve, reject) => {
        sleep(time, abort)
            .then(() => {
                reject(
                    new TimeoutError(
                        substitute(message, { time }),
                        origin,
                        level
                    )
                )
            })
            .catch(() => resolve(void 0))
    })
}
