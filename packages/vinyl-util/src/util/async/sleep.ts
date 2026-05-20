/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReadonlyAbort } from './Abort'
import { promise } from './promise'

/**
 * Returns a promise that resolves after the given amount of time.
 *
 * Usage example:
 * ```
 * async function doThingsWithAbort(abort) {
 *   await foo();
 *   await sleep(2, abort);
 *   await foo();
 *   await sleep(5, abort);
 *   await foo();
 * }
 *
 * const abort = new Abort();
 * doThingsWithAbort(abort).catch(() => console.log('aborted'))';
 *
 * abort.abort();
 * ```
 *
 * @param time The time to sleep, in seconds.
 * @param abort If provided, will reject the returned promise with the signal's abort
 * reason when aborted. If the signal is already aborted and time is less than or equal to zero,
 * the abort signal takes precedence.
 */
export function sleep(
    time: number,
    abort?: ReadonlyAbort | null
): Promise<void> {
    if (abort?.aborted()) return Promise.reject(abort.reason!)
    if (time <= 0.0) return Promise.resolve(void 0)
    return promise((resolve) => {
        const timeoutId = setTimeout(() => {
            resolve(void 0)
        }, time * 1000)
        return () => clearTimeout(timeoutId)
    }, abort)
}
