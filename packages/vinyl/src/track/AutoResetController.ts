/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type AnyRecord,
    type Clearable,
    createDisposer,
    type Disposable,
    EventHostImpl,
    getNetworkState,
    logDebug,
    onAny,
    type ReadonlyEventHost,
    RequestError,
    type Unsubscribe,
} from '@amazon/vinyl-util'
import type { PlaybackController } from '../playback/PlaybackController'
import type { ChangeEvent } from '../event/ChangeEvent'

export interface AutoResetControllerEventMap {
    /**
     * Notifies that playback errors should be reset and retried.
     */
    readonly reset: AnyRecord

    /**
     * Dispatched when {@link AutoResetController.resetPending} changes.
     */
    readonly resetPendingChange: ChangeEvent<boolean>
}

/**
 * Notifies when playback should be reset and retried after a transient,
 * potentially-recoverable error.
 *
 * Once an eligible error is set, the controller watches for opportunities
 * to emit a `reset` event:
 * - Immediately when the network transitions back to online
 * - After a timeout interval, if online and retries are not exhausted
 * - Immediately on user playback actions (play, pause, seeking, playing)
 *
 * Each error triggers a single retry timeout. If another error occurs
 * after a reset, {@link AutoResetController.setError} should be called again
 * to schedule the next retry attempt.
 */
export interface AutoResetController
    extends ReadonlyEventHost<AutoResetControllerEventMap>, Clearable {
    /**
     * Sets the current playback error and, if eligible, begins watching for
     * retry opportunities.
     *
     * An error is eligible when it is a {@link RequestError} that did not
     * receive an HTTP response (i.e. `response == null`), indicating a
     * transient network failure such as connection loss or DNS failure.
     * All other errors — including HTTP failures with a response (4xx/5xx),
     * and non-RequestError errors — are ignored, since those are unlikely
     * to recover on their own.
     *
     * Subsequent calls while an error is already set are ignored until the
     * error is cleared via a reset emission or {@link Clearable.clear}.
     *
     * After a reset, if another eligible error occurs, this method should
     * be called again to schedule the next retry attempt.
     *
     * @param error The error to monitor for retry opportunities
     */
    setError(error: Error): void

    /**
     * True while an eligible error is being watched and a `reset` event
     * may still be emitted. Becomes false once the error is cleared, a
     * reset is emitted, or all retries are exhausted.
     *
     * Listen to `resetPendingChange` events for changes.
     */
    readonly resetPending: boolean
}

export interface AutoResetControllerImplDeps {
    readonly playbackController: PlaybackController
}

export interface AutoResetControllerImplOptions {
    /**
     * If false, disables auto reset behavior.
     * default: true
     */
    readonly enabled: boolean

    /**
     * The total number of times to reset when there has not been successful
     * playback.
     *
     * E.g. a retryInterval of 30 and maxRetries of 30 will retry for 15 minutes before stopping.
     *
     * default: 30
     */
    readonly maxRetries: number

    /**
     * The number of seconds between retries.
     *
     * When an error is set, a single timeout is scheduled for this interval.
     * If the retry limit hasn't been reached and the device is online, a reset
     * event is emitted. For subsequent errors after reset, setError() must be
     * called again to schedule the next retry timeout.
     */
    readonly retryInterval: number
}

export const defaultResetControllerOptions = {
    enabled: true,
    maxRetries: 30,
    retryInterval: 30,
} as const satisfies AutoResetControllerImplOptions

export class AutoResetControllerImpl
    extends EventHostImpl<AutoResetControllerEventMap>
    implements AutoResetController, Disposable
{
    get [Symbol.toStringTag](): string {
        return 'AutoResetControllerImpl'
    }

    private readonly options: AutoResetControllerImplOptions
    private _error: Error | null = null
    private watchSub: Unsubscribe | null = null
    private currentRetry = 0
    private disposer = createDisposer()

    constructor(
        readonly deps: AutoResetControllerImplDeps,
        options?: Partial<AutoResetControllerImplOptions>
    ) {
        super()
        logDebug(this, 'constructor')
        this.options = {
            ...defaultResetControllerOptions,
            ...options,
        }

        this.disposer.add(
            onAny(
                deps.playbackController,
                ['play', 'pause', 'seeking', 'playing'],
                (_event) => {
                    // On certain user-initiated playback events, reset the currentRetry count and emit a reset event
                    // if in an error state.
                    this.currentRetry = 0
                    this.reset()
                }
            )
        )
    }

    setError(error: Error): void {
        if (!this.options.enabled || this._error) return
        if (error instanceof RequestError && error.response == null) {
            this._error = error
            this.setResetPending(true)
        }
    }

    get resetPending(): boolean {
        return this.watchSub != null
    }

    private setResetPending(value: boolean): void {
        if (this.resetPending === value) {
            logDebug(this, 'setResetPending', value, 'no-op')
            return
        }
        logDebug(this, 'setResetPending', value)
        this.watchSub?.()
        this.watchSub = null
        if (value) {
            const networkState = getNetworkState()
            const { add, dispose: watchSub } = createDisposer()
            this.watchSub = watchSub
            add(
                networkState.on('online', () => {
                    logDebug(this, 'online, emitting reset')
                    this.reset()
                })
            )

            const intervalId = setTimeout(() => {
                if (this.currentRetry++ < this.options.maxRetries) {
                    if (networkState.onLine) {
                        logDebug(this, 'interval, emitting reset')
                        this.reset()
                    }
                } else {
                    logDebug(this, 'max retries exhausted, pausing playback')
                    this.setResetPending(false)
                }
            }, this.options.retryInterval * 1000)
            add(() => clearTimeout(intervalId))
        }
        this.dispatch('resetPendingChange', {
            previous: !value,
            current: value,
        })
    }

    private reset(): void {
        if (!this._error) return
        this.clear()
        this.dispatch('reset', {})
    }

    clear() {
        if (!this._error) return
        this._error = null
        this.setResetPending(false)
    }

    get disposed(): boolean {
        return this.disposer.disposed
    }

    dispose(): void {
        this.disposer.dispose()
        this.clear()
    }
}
