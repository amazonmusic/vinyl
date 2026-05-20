/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type MaybePromise, noop } from '@amazon/vinyl-util'

export function startViewTransition(
    cb: () => MaybePromise<any>
): Promise<void> {
    if ('startViewTransition' in document) {
        const transition = (document as any).startViewTransition(cb)
        transition.ready.catch(noop)
        return transition.finished
    } else {
        cb()
        return Promise.resolve()
    }
}
