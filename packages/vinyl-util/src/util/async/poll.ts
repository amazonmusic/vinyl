/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReadonlyAbort } from './Abort'
import type { Maybe } from '../type'
import { sleep } from './sleep'

/**
 * Default interval between predicate evaluations while polling, in seconds.
 */
const DEFAULT_POLL_INTERVAL = 0.05

export interface PollOptions {
    /**
     * How long to keep polling before giving up, in seconds. If omitted,
     * polling continues indefinitely until the predicate returns `true` (or the
     * signal aborts).
     */
    readonly timeout?: number

    /**
     * If provided, aborting rejects the returned promise with the signal's
     * abort reason, cancelling the poll.
     */
    readonly abort?: Maybe<ReadonlyAbort>

    /**
     * How often to re-evaluate the predicate, in seconds. Defaults to
     * {@link DEFAULT_POLL_INTERVAL}.
     */
    readonly pollInterval?: number
}

/**
 * Repeatedly evaluates `predicate` until it returns `true` or the timeout
 * elapses, resolving to the predicate's final value. Useful for waiting on
 * asynchronous state to settle without wiring up an event subscription.
 *
 * @param predicate Evaluated immediately and then every `pollInterval` seconds.
 * Polling stops as soon as it returns `true`.
 * @param options Optional {@link PollOptions}. With no `timeout`, polling
 * continues indefinitely until the predicate is `true` or `abort` fires.
 * @returns `true` if the predicate became true within the timeout, otherwise
 * `false`.
 */
export async function poll(
    predicate: () => boolean,
    options: PollOptions = {}
): Promise<boolean> {
    const { timeout, abort, pollInterval = DEFAULT_POLL_INTERVAL } = options
    const deadline = timeout == null ? Infinity : Date.now() + timeout * 1000
    let result = predicate()
    while (!result && Date.now() < deadline) {
        await sleep(pollInterval, abort)
        result = predicate()
    }
    return result
}
