/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Disposable, Maybe } from '@amazon/vinyl-util'
import {
    createAbortSlot,
    isSilentError,
    type ReadonlyAbort,
} from '@amazon/vinyl-util'

export enum SegmentStatus {
    /**
     * This segment has not been requested.
     */
    INACTIVE = 'inactive',

    /**
     * The segment has been requested but not yet completed.
     */
    PENDING = 'pending',

    /**
     * The segment has finished requesting.
     */
    RESOLVED = 'resolved',

    /**
     * The segment failed to load.
     */
    ERRED = 'erred',
}

/**
 * A function that returns a promise to segment data.
 */
export type SegmentDataProvider = (
    abort?: Maybe<ReadonlyAbort>
) => Promise<ArrayBuffer>

/**
 * A SegmentSlot is a holder for a segment buffer. It may be requested, cleared, and its status observed.
 */
export class SegmentDataSlot implements Disposable {
    /**
     * Called when the status has changed.
     */
    onStatusChange: (() => void) | null = null

    private _status: SegmentStatus = SegmentStatus.INACTIVE
    private readonly abortSlot = createAbortSlot()

    private bufferPromise: Promise<ArrayBuffer> | null = null

    constructor(private readonly requestSegmentData: SegmentDataProvider) {}

    /**
     * This segment's request status.
     */
    get status(): SegmentStatus {
        return this._status
    }

    private set status(value: SegmentStatus) {
        this._status = value
        if (this.onStatusChange) this.onStatusChange()
    }

    /**
     * Aborts the request if the status is currently {@link SegmentStatus.PENDING}, and clears the cached buffer.
     * The status will go back to {@link SegmentStatus.INACTIVE} and the segment may be requested again in the future.
     */
    clear(): void {
        if (this.status === SegmentStatus.INACTIVE) return
        this.abortSlot.abort()
        this.bufferPromise = null
        this.status = SegmentStatus.INACTIVE
    }

    /**
     * Begins the segment request now if it has not already been requested.
     * The promise returned will settle after this slot's status has updated and onStatusChange callback invoked.
     */
    request(): Promise<ArrayBuffer> {
        if (!this.bufferPromise) {
            this.status = SegmentStatus.PENDING

            // Chains status handling to the promise returned by requestSegment.
            this.bufferPromise = this.requestSegmentData(this.abortSlot.value)
                .then((result) => {
                    this.status = SegmentStatus.RESOLVED
                    return result
                })
                .catch((error) => {
                    if (isSilentError(error)) {
                        // Allows this data slot to be requested again.
                        this.bufferPromise = null
                        this.status = SegmentStatus.INACTIVE
                    } else {
                        // A higher severity error, do not try again.
                        this.status = SegmentStatus.ERRED
                    }
                    throw error
                })
        }
        return this.bufferPromise
    }

    /**
     * Clears this segment and removes its handler.
     */
    dispose(): void {
        this.clear()
        this.onStatusChange = null
    }
}
