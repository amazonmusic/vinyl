/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Disposable } from '../../core/disposable'
import type { TimeoutId } from '../../global/environment'
import { TimeoutError } from '../../error/TimeoutError'
import { Abort, type ReadonlyAbort } from './Abort'
import { sleep } from './sleep'
import type { Timestamp } from '../date/date'
import { substitute } from '../string/string'
import type { Maybe } from '../type'

/**
 * A `TimeoutController` is an {@link ReadonlyAbort} implementation that will abort either after
 * an elapsed timeout, an explicit abort call, or if the optional external abort signal fires.
 *
 * This allows a function (such as the network fetch layer) to abort from an externally provided
 * abort signal, while maintaining its own timeout and abort logic internally.
 */
export class TimeoutController
    extends Abort
    implements ReadonlyAbort, Disposable
{
    private readonly timeoutId: TimeoutId
    private readonly abortSub: (() => void) | null

    private readonly startedAt: Timestamp = Date.now()

    /**
     * @param timeout The number of seconds before the returned abort signal will abort with a
     * {@link TimeoutError}.
     * @param abort An abort signal to cascade.
     * @param message The timeout message. Uses one token `{time}` which will be replaced by the
     * timeout.
     */
    constructor(
        readonly timeout: number,
        abort?: Maybe<ReadonlyAbort>,
        private readonly message = 'Timed out after {time}s'
    ) {
        super()
        this.timeoutId = setTimeout(
            () => this.abortWithTimeout(),
            timeout * 1000
        )
        const abortHandler = () => this.abort(abort!.reason!)
        this.abortSub = abort?.on('abort', abortHandler) ?? null
        if (abort?.aborted()) abortHandler()
    }

    /**
     * Aborts with a {@link TimeoutError}
     */
    abortWithTimeout() {
        this.abort(
            new TimeoutError(substitute(this.message, { time: this.timeout }))
        )
    }

    /**
     * Sleeps the given amount of time, or immediately rejects if the sleep will cause a timeout.
     * @param time The number of seconds to sleep.
     */
    sleep(time: number): Promise<void> {
        const elapsed = (Date.now() - this.startedAt) / 1000
        if (elapsed + time >= this.timeout) {
            this.abortWithTimeout()
            return Promise.reject(this.reason!)
        }
        return sleep(time, this)
    }

    dispose() {
        clearTimeout(this.timeoutId)
        if (this.abortSub) this.abortSub()
    }
}
