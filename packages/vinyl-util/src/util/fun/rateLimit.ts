/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Disposable } from '../../core/disposable'
import { DisposedError } from '../../core/disposable'
import { IllegalArgumentError } from '../../error/IllegalArgumentError'
import { TimeoutSlot } from '../async/TimeoutSlot'

export interface RateLimitOptions {
    /**
     * The maximum number of calls that may run immediately in a burst — the
     * token bucket's capacity. Must be at least 1.
     */
    readonly capacity: number

    /**
     * Seconds to refill one token. In steady state the inner function runs at
     * most once every `interval` seconds. Must be greater than 0.
     */
    readonly interval: number
}

export interface RateLimitedCallback extends Disposable {
    (): void

    /**
     * Refills the bucket to capacity and immediately invokes any queued
     * (delayed) calls.
     */
    reset(): void
}

/**
 * Rate-limits invocations with a token bucket. The bucket holds up to
 * {@link RateLimitOptions.capacity} tokens and refills one token every
 * {@link RateLimitOptions.interval} seconds. Each call consumes a token and runs
 * immediately; a call made while the bucket is empty is queued and invoked as
 * tokens refill (in call order).
 *
 * Unlike {@link throttle}, which drops calls that arrive within its window,
 * `rateLimit` never drops a call — it only delays the ones that exceed the rate.
 * A full bucket allows an initial burst of `capacity` calls.
 *
 * @param inner The function to invoke at the limited rate.
 * @param options The bucket capacity (max burst) and refill interval.
 * @return A callback that queues-and-limits invocations of `inner`, with `reset`
 * and `dispose` handles. `dispose` cancels any queued calls and prevents further
 * invocation.
 */
export function rateLimit(
    inner: () => void,
    options: RateLimitOptions
): RateLimitedCallback {
    const { capacity, interval } = options
    if (capacity < 1)
        throw new IllegalArgumentError('capacity must be at least 1.')
    if (interval <= 0)
        throw new IllegalArgumentError('interval must be greater than 0.')

    const intervalMs = interval * 1000
    let tokens = capacity
    let lastRefillMs = Date.now()
    // The number of calls waiting for a token. Inner takes no arguments, so a
    // count preserves call order without needing a queue of thunks.
    let pending = 0
    const timeout = new TimeoutSlot()
    let disposed = false

    // Credits whole tokens for the time elapsed since the last refill, capped at
    // capacity. When the bucket is full the refill clock is synced to now so idle
    // time can't bank tokens beyond capacity.
    const refill = () => {
        const now = Date.now()
        const refilled = Math.floor((now - lastRefillMs) / intervalMs)
        if (refilled > 0) {
            tokens = Math.min(capacity, tokens + refilled)
            lastRefillMs += refilled * intervalMs
        }
        if (tokens === capacity) lastRefillMs = now
    }

    const drain = () => {
        refill()
        while (pending > 0 && tokens >= 1) {
            tokens -= 1
            pending -= 1
            inner()
        }
        if (pending > 0 && !timeout.active) {
            // Wait until the next whole token refills, then drain again.
            const nextTokenMs = intervalMs - (Date.now() - lastRefillMs)
            timeout.set(drain, nextTokenMs / 1000)
        }
    }

    return Object.assign(
        () => {
            if (disposed) throw new DisposedError()
            pending += 1
            drain()
        },
        {
            reset() {
                tokens = capacity
                lastRefillMs = Date.now()
                if (timeout.active) timeout.clear()
                while (pending > 0) {
                    pending -= 1
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
