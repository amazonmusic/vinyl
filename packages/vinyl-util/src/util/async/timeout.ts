/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimeoutError } from '@/error/TimeoutError'
import type { ReadonlyAbort } from './Abort'
import { Abort } from './Abort'
import { sleep } from './sleep'
import { substitute } from '@/util/string/string'
import { ErrorOrigin } from '@/error/ErrorOrigin'
import { ErrorLevel } from '@/error/ReportableError'

export const DEFAULT_TIMEOUT_MESSAGE = 'Timed out after {time}s'

/**
 * Races a promise with a timeout, rejecting with a {@link TimeoutError} if the timeout is
 * reached before the provided promise.
 *
 * @param promise The promise to race against a timeout.
 * @param time The number of seconds to wait. If undefined, the promise is returned without
 * wrapping.
 * @param message The message to set in the {@link TimeoutError}. Uses `{time}` token.
 * @param origin The error origin. (default: `ErrorOrigin.INTERNAL`)
 * @param level The error level (default: `ErrorLevel.FATAL`)
 */
export function withTimeout<T>(
    promise: PromiseLike<T>,
    time?: number,
    message = DEFAULT_TIMEOUT_MESSAGE,
    origin: string = ErrorOrigin.INTERNAL,
    level: ErrorLevel = ErrorLevel.FATAL
): Promise<T> {
    if (time === undefined) return Promise.resolve(promise)
    const abort = new Abort()
    return Promise.race([
        promise,
        timeout(time, abort, message, origin, level),
    ]).then(() => {
        abort.abort()
        return promise
    })
}

/**
 * Returns a promise that will reject after the provided number of seconds.
 * If the optional abort signal is aborted, the timer will be canceled and the promise resolved.
 * This is the inverse of {@link sleep}
 *
 * @param time The number of seconds to wait.
 * @param abort If provided, when aborted (regardless of reason) will resolve the returned
 * promise.
 * @param message The message to be used in the TimeoutError in case of timeout. Uses `{time}` token.
 * @param origin The error origin. (default: `ErrorOrigin.INTERNAL`)
 * @param level The error level (default: `ErrorLevel.FATAL`)
 */
export function timeout(
    time: number,
    abort?: ReadonlyAbort,
    message = 'Timed out after {time}s',
    origin: string = ErrorOrigin.INTERNAL,
    level: ErrorLevel = ErrorLevel.FATAL
): Promise<void> {
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
