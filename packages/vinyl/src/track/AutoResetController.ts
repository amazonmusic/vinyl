/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type AnyRecord,
    type Clearable,
    createDisposer,
    type Disposable,
    ErrorOrigin,
    EventHostImpl,
    getNetworkState,
    logDebug,
    onAny,
    type ReadonlyEventHost,
    ReportableError,
    type Unsubscribe,
} from '@amazon/vinyl-util'
import type { PlaybackController } from '@/playback/PlaybackController'

export interface AutoResetControllerEventMap {
    /**
     * Notifies that playback errors should be reset and retried.
     */
    readonly reset: AnyRecord
}

/**
 * Notifies when playback should be reset and retried.
 *
 * The controller monitors for retry opportunities after an error is set:
 * - Immediately on network 'online' events
 * - After a timeout interval if online
 * - Immediately on user playback actions (play, pause, seeking, playing)
 *
 * Each error triggers a single timeout. If another error occurs after a reset,
 * setError() should be called again to schedule the next retry attempt.
 */
export interface AutoResetController
    extends ReadonlyEventHost<AutoResetControllerEventMap>,
        Clearable {
    /**
     * Sets the current playback error and begins monitoring for retry opportunities.
     *
     * Only SERVICE_INTERNAL ReportableErrors are monitored. Subsequent calls while
     * an error is already set are ignored until the error is cleared via reset or clear().
     *
     * After a reset, if another error occurs, this method should be called again
     * to schedule the next retry attempt.
     *
     * @param error The error to monitor for retry opportunities
     */
    setError(error: Error): void
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
        if (
            error instanceof ReportableError &&
            error.origin === ErrorOrigin.SERVICE_INTERNAL
        ) {
            this._error = error
            this.setWatching(true)
        }
    }

    private setWatching(value: boolean): void {
        logDebug(this, 'setWatching', value)
        this.watchSub?.()
        this.watchSub = null
        if (!value) return
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
                this.setWatching(false)
            }
        }, this.options.retryInterval * 1000)
        add(() => clearTimeout(intervalId))
    }

    private reset(): void {
        if (!this._error) return
        this.clear()
        this.dispatch('reset', {})
    }

    clear() {
        if (!this._error) return
        this._error = null
        this.setWatching(false)
    }

    get disposed(): boolean {
        return this.disposer.disposed
    }

    dispose(): void {
        this.disposer.dispose()
        this.clear()
    }
}
