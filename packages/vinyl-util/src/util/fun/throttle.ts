/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Disposable } from '../../core/disposable'
import { DisposedError } from '../../core/disposable'
import { IllegalArgumentError } from '../../error/IllegalArgumentError'
import { TimeoutSlot } from '../async/TimeoutSlot'

export interface ThrottleOptions {
    /**
     * If true, the first invocation of a throttled function will pass through.
     */
    readonly leading: boolean

    /**
     * If true, when the throttle window time has elapsed, the function will be invoked.
     * Either leading or trailing must be true.
     * When trailing is true, timers will be used
     */
    readonly trailing: boolean
}

export interface ThrottledCallback extends Disposable {
    (): void

    /**
     * Resets the throttle timer.
     * If an inner call is pending, it will be immediately invoked.
     */
    reset(): void
}

const defaultThrottleOptions: ThrottleOptions = {
    leading: true,
    trailing: true,
} as const

/**
 * Throttle returns a function that limits the rate of invocations.
 *
 * @param inner The function to invoke at a throttled rate.
 * @param duration The interval (in seconds) for which the throttled function will be limited.
 * @param options Options for which ends of the window the function should be invoked. If omitted,
 * leading and trailing will be true.
 * @return Returns a method that, when invoked, will invoke the inner method at a throttled rate.
 * The returned method will have a `dispose` handle to clear any active timers and prevent
 * further invocation.
 */
export function throttle(
    inner: () => void,
    duration: number,
    options: Partial<ThrottleOptions> = defaultThrottleOptions
): ThrottledCallback {
    options = {
        leading: false,
        trailing: false,
        ...options,
    }
    if (!options.leading && !options.trailing)
        throw new IllegalArgumentError(
            'One of leading or trailing must be true.'
        )
    // The last timestamp the inner method was invoked.
    let lastTime = Number.NEGATIVE_INFINITY
    const timeout = new TimeoutSlot()
    let disposed = false
    return Object.assign(
        () => {
            if (disposed) throw new DisposedError()
            const now = Date.now() / 1000
            const pastDuration = now - lastTime >= duration
            if (pastDuration) {
                lastTime = now
                if (options.leading) inner()
            }
            if (
                !timeout.active &&
                options.trailing &&
                !(pastDuration && options.leading)
            ) {
                timeout.set(
                    () => {
                        lastTime = Date.now() / 1000
                        inner()
                    },
                    duration - now + lastTime
                )
            }
        },
        {
            reset() {
                lastTime = Number.NEGATIVE_INFINITY
                if (timeout.active) {
                    timeout.clear()
                    inner()
                }
            },

            dispose() {
                disposed = true
                timeout.dispose()
            },
        }
    )
}
