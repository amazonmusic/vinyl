/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReadonlyAbort } from './Abort'
import type { Maybe } from '@/util/type'

/**
 * Races a promise and an abort signal.
 * Generally, it is better to write your promises in a way that they reject and cleanup after an
 * abort event (see `promise`), however, external promises don't always provide this
 * capability.
 * Some browsers accept an abort signal for `fetch` and `addEventListener`, but this is not
 * widely supported enough to be relied upon.
 *
 * If both the abort signal is in an aborted state, and the given promise is in a resolved state,
 * the returned promise will be rejected with the abort reason.
 */
export function withAbort<T>(
    promise: Promise<T>,
    abort?: Maybe<ReadonlyAbort>
): Promise<T> {
    if (!abort) return promise
    if (abort.aborted()) return Promise.reject(abort.reason!)
    return new Promise((resolve, reject) => {
        const abortSub = abort.on(
            'abort',
            () => {
                reject(abort.reason!)
            },
            { once: true }
        )
        promise.then(resolve).catch(reject).finally(abortSub)
    })
}
