/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createLogPrefix,
    createTaskQueue,
    createTimeRangesReader,
    type Disposable,
    emptyRanges,
    ErrorOrigin,
    IllegalStateError,
    logDebug,
    type LogTarget,
    nextEventAsPromise,
    type ReadonlyRanges,
    type Task,
} from '@amazon/vinyl-util'
import { nextSourceBufferIdle } from '@/util/media/sourceBuffer'
import { SourceBufferError } from './error/SourceBufferError'
import type {
    MediaSourceController,
    SourceBufferRef,
} from './MediaSourceController'
import type { ContentType } from '@/streaming/MediaQualityMetadata'

// Prevents unintentionally dropped keyframes
export const APPEND_WINDOW_START_OFFSET = 0.05
export const APPEND_WINDOW_END_OFFSET = 0.01

// The number of seconds before aborting the wait for media source controller's readyToAppend event.
export const READY_TO_APPEND_TIMEOUT = 30

export type SourceBufferControllerFactory = () => SourceBufferController

export interface SourceBufferController extends Disposable {
    readonly buffered: ReadonlyRanges

    /**
     * Returns true if an operation is currently running.
     */
    isBusy(): boolean

    /**
     * Enqueues an operation.
     * Guaranteed to be invoked when the source buffer is not updating.
     */
    enqueue<T = void>(task: Task<T>): Promise<T>

    /**
     * Enqueues appending an initialization segment, reinitializing the decoder.
     */
    appendInit(data: ArrayBuffer, mimeType: string): Promise<void>

    /**
     * Enqueues appending a media segment.
     * An `appendInit` call must precede appending media segments.
     * A promise is returned that will resolve when the task is complete.
     */
    append(data: ArrayBuffer): Promise<void>

    /**
     * Sets the timestampOffset on the backing source buffer.
     */
    setTimestampOffset(timestampOffset: number): Promise<void>

    /**
     * Sets the append window on the backing source buffer.
     * Keyframes outside this range will be discarded.
     */
    setAppendWindow(
        appendWindowStart?: number,
        appendWindowEnd?: number
    ): Promise<void>

    /**
     * Removes media segments within a specific time range from the SourceBuffer.
     */
    remove(startTime: number, endTime: number): Promise<void>

    /**
     * Aborts any pending buffers and clears all buffered ranges.
     */
    clear(): Promise<void>
}

export interface SourceBufferControllerImplDeps {
    /**
     * Produces the source buffer for appending.
     */
    readonly mediaSourceController: MediaSourceController
}

/**
 * The SourceBufferController manages a single source buffer. It provides queued commands for appending and clearing
 * data.
 */
export class SourceBufferControllerImpl
    implements LogTarget, SourceBufferController, Disposable
{
    get [Symbol.toStringTag](): string {
        return 'SourceBufferController'
    }

    private sourceBufferRef: SourceBufferRef | null = null

    private mimeType: string | null = null
    private queue = createTaskQueue()

    readonly logPrefix = createLogPrefix(this)
    private readonly mediaSourceController: MediaSourceController

    constructor(
        deps: SourceBufferControllerImplDeps,
        readonly contentType: ContentType
    ) {
        logDebug(this, 'constructed, contentType:', contentType)
        this.mediaSourceController = deps.mediaSourceController
    }

    private get sourceBuffer(): SourceBuffer | null {
        return this.sourceBufferRef && this.sourceBufferRef.value
    }

    private _buffered: ReadonlyRanges | null = null
    get buffered(): ReadonlyRanges {
        if (this._buffered == null) {
            if (!this.sourceBuffer) this._buffered = emptyRanges
            else
                this._buffered = createTimeRangesReader(
                    this.sourceBuffer.buffered
                )
        }
        return this._buffered
    }

    /**
     * Clears the cached buffered ranges. They will be recreated next access.
     */
    private clearBufferedCache = () => {
        this._buffered = null
    }

    isBusy(): boolean {
        return this.queue.running > 0
    }

    enqueue<T = void>(task: Task<T>): Promise<T> {
        return this.queue.enqueue(task)
    }

    async appendInit(data: ArrayBuffer, mimeType: string): Promise<void> {
        return this.queue.enqueue(async (abort) => {
            if (this.mimeType !== mimeType) {
                if (this.sourceBuffer && 'changeType' in this.sourceBuffer) {
                    // There is an existing source buffer and its mime type can be changed.
                    logDebug(this, 'changeType', mimeType)
                    this.sourceBuffer.changeType(mimeType)
                } else {
                    // There is either no existing source buffer or a new buffer must be created
                    // with the new mime type.
                    this.sourceBufferRef?.dispose()
                    const newSourceBufferRef =
                        this.mediaSourceController.createSourceBuffer(
                            this.contentType,
                            mimeType
                        )
                    // Do not append to the source buffer until all streams have been created:
                    if (!this.mediaSourceController.readyToAppend)
                        await nextEventAsPromise(
                            this.mediaSourceController,
                            'readyToAppend',
                            { timeout: READY_TO_APPEND_TIMEOUT, abort }
                        ).catch((error) => {
                            // The readyToAppend was aborted or timed out, dispose the source buffer
                            newSourceBufferRef.dispose()
                            throw error
                        })
                    this.sourceBufferRef = newSourceBufferRef
                }
                this.mimeType = mimeType
            }
            const sourceBuffer = this.sourceBuffer!
            logDebug(this, `appending init ${data.byteLength} bytes`)
            sourceBuffer.appendBuffer(data)
            await this.nextIdle()
            logDebug(this, 'appended init')
        })
    }

    async append(data: ArrayBuffer): Promise<void> {
        return this.queue.enqueue(async () => {
            logDebug(this, `appending ${data.byteLength} bytes`)
            const sourceBuffer = this.sourceBuffer
            if (!sourceBuffer)
                throw new SourceBufferError(
                    'media segment provided before init segment',
                    ErrorOrigin.INTERNAL
                )
            sourceBuffer.appendBuffer(data)
            await this.nextIdle()
            logDebug(this, 'appended', this.buffered)
        })
    }

    setTimestampOffset(timestampOffset: number): Promise<void> {
        return this.queue.enqueue(() => {
            const sourceBuffer = this.sourceBuffer
            if (!sourceBuffer)
                throw new IllegalStateError(
                    'source buffer must be initialized before setting timestamp offset'
                )
            logDebug(this, 'timestampOffset:', timestampOffset.toFixed(4))
            sourceBuffer.timestampOffset = timestampOffset
        })
    }

    setAppendWindow(
        appendWindowStart: number = 0,
        appendWindowEnd: number = Number.POSITIVE_INFINITY
    ): Promise<void> {
        return this.queue.enqueue(() => {
            const sourceBuffer = this.sourceBuffer
            if (!sourceBuffer)
                throw new IllegalStateError(
                    'source buffer must be initialized before setting append window'
                )
            const finalAppendWindowStart = Math.max(
                0,
                appendWindowStart - APPEND_WINDOW_START_OFFSET
            )
            const finalAppendWindowEnd =
                appendWindowEnd + APPEND_WINDOW_END_OFFSET
            logDebug(
                this,
                'appendWindow:',
                finalAppendWindowStart.toFixed(4),
                finalAppendWindowEnd.toFixed(4)
            )

            // start may not be greater than end, even temporarily.
            // Avoids the error: "Failed to set the 'appendWindow___' property"
            sourceBuffer.appendWindowStart = 0
            sourceBuffer.appendWindowEnd = finalAppendWindowEnd
            sourceBuffer.appendWindowStart = finalAppendWindowStart
        })
    }

    remove(startTime: number, endTime: number): Promise<void> {
        return this.queue.enqueue(async () => {
            if (endTime > startTime) {
                logDebug(this, `removing range: ${startTime}-${endTime}`)
                this.sourceBuffer?.remove(startTime, endTime)
                await this.nextIdle()
                logDebug(this, 'removed, new buffered:', this.buffered)
            }
        })
    }

    /**
     * Returns a promise that resolves when the source buffer is no longer updating.
     * @private
     */
    private nextIdle = (): Promise<void> =>
        nextSourceBufferIdle(this.sourceBuffer).finally(this.clearBufferedCache)

    async clear(): Promise<void> {
        await this.remove(0, Number.POSITIVE_INFINITY)
    }

    /**
     * Aborts any pending operations and disposes the backed SourceBuffer.
     */
    dispose() {
        logDebug(this, 'dispose')
        this.queue.abort()
        this.sourceBufferRef?.dispose()
        this.sourceBufferRef = null
    }
}
