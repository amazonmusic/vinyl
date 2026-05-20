/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Disposable } from '@/core/disposable'
import { DisposedError } from '@/core/disposable'
import { TimeoutSlot } from '@/util/async/TimeoutSlot'

export type DebounceCallback = Disposable & (() => void)

/**
 * Debounce wraps a callback, ensuring it only executes after a certain period of inactivity.
 *
 * @param inner The function to execute after a given period of inactivity.
 * @param duration The number of seconds the returned wrapper function must not be called before the inner function
 * is invoked.
 * @return Returns callback wrapper that enforces inactivity. This may be disposed.
 */
export function debounce(
    inner: () => void,
    duration: number
): DebounceCallback {
    const timeout = new TimeoutSlot()
    let disposed = false
    return Object.assign(
        () => {
            if (disposed) throw new DisposedError()
            timeout.set(inner, duration)
        },
        {
            dispose() {
                disposed = true
                timeout.dispose()
            },
        }
    )
}
