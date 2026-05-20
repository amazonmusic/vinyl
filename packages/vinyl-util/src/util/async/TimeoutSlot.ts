/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Disposable } from '@/core/disposable'
import { DisposedError } from '@/core/disposable'
import type { TimeoutId } from '@/global/environment'

/**
 * A TimeoutSlot provides a way to have a managed window timeout that can be added to a
 * disposer, and guarantee that there is only one timeout active at a time.
 */
export class TimeoutSlot implements Disposable {
    private timeoutId: TimeoutId | null = null
    private disposed = false

    /**
     * Returns true if there is an active timeout pending.
     */
    get active(): boolean {
        return this.timeoutId != null
    }

    /**
     * Sets a timeout, clearing any existing timeout first.
     *
     * @param callback The callback to invoke after the given time has elapsed.
     * @param time The amount of time to wait, in seconds.
     */
    set(callback: () => void, time?: number) {
        if (this.disposed) throw new DisposedError()
        this.clear()
        this.timeoutId = setTimeout(
            () => {
                this.timeoutId = null
                callback()
            },
            time == null ? time : time * 1000
        )
    }

    /**
     * Clears the existing timeout.
     */
    clear() {
        if (this.timeoutId == null) return
        clearTimeout(this.timeoutId)
        this.timeoutId = null
    }

    /**
     * Clears the timeout and throws an error if a new one is attempted to be set.
     */
    dispose(): void {
        this.clear()
        this.disposed = true
    }
}
