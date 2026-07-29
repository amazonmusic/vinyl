/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type AnyRecord,
    type Clearable,
    createAbortSlot,
    createDisposer,
    createTaskQueue,
    type Disposable,
    type Disposer,
    EventHostImpl,
    getLogLevel,
    isSilentError,
    LinkedList,
    logDebug,
    LogLevel,
    logVerbose,
    logWarn,
    type ReadonlyEventHost,
    throttle,
} from '@amazon/vinyl-util'
import type { ReadonlyPlaybackController } from '../../playback/ReadonlyPlaybackController'
import type { SourceBufferController } from './SourceBufferController'
import type { ReadonlySegmentController } from '../SegmentController'
import type { SegmentReference } from '../SegmentReference'
import type { BasicErrorEvent } from '../../event/BasicErrorEvent'
import type { ChangeEvent } from '../../event/ChangeEvent'
import type { ContentType, MediaQualityMetadata } from '../MediaQualityMetadata'
import type { CodecUnsupportedEvent } from '../StreamingEventMap'
import { type MediaSourceController } from './MediaSourceController'
import { SEGMENT_START_AFFORDANCE } from '../SegmentController'
import { SourceBufferError } from './error/SourceBufferError'
import { denylistCodecsFromMimeType } from './codecDenylist'

/**
 * The interval to throttle polling the buffer.
 * Reset after a seek.
 * @private
 */
export const POLL_BUFFER_THROTTLE = 0.1

/**
 * If segments are too large to append, reduces the max append size.
 */
export const QUOTA_REACHED_SCALE = 0.8

/**
 * If quota exceeded errors are hit, the max append size will not be reduced below this value and the buffering
 * controller will be set to an erred state.
 */
export const MIN_APPEND_SIZE = 524288 // 512 * 1024

/**
 * If the content type does not match a config setting.
 */
export const DEFAULT_MAX_APPEND_SIZE = 10485760 // 10 * 1024 * 1024

export interface BufferingControllerEventMap {
    /**
     * Dispatched when an error of severity warning or fatal occurred while buffering.
     */
    readonly error: BasicErrorEvent

    /**
     * Dispatched when the currently playing media encoding has changed.
     */
    readonly playbackQualityChange: ChangeEvent<MediaQualityMetadata | null>

    /**
     * Dispatched when the currently buffering quality changes.
     * This is dispatched before the segment is appended.
     */
    readonly bufferingQualityChange: ChangeEvent<MediaQualityMetadata | null>

    /**
     * The last segment has finished appending.
     */
    readonly bufferingEnded: AnyRecord

    /**
     * A codec the browser reported as supported failed to decode on append and
     * has been denylisted. Dispatched instead of `error` so the media can be
     * reloaded and fall back to a codec that decodes.
     */
    readonly codecUnsupported: CodecUnsupportedEvent
}

export interface BufferingController
    extends
        ReadonlyEventHost<BufferingControllerEventMap>,
        Clearable,
        Disposable {
    /**
     * The last error emitted.
     * Buffering will halt if this controller is in an error state.
     * Deactivating this controller will reset the error state.
     */
    readonly error: Error | null

    /**
     * The currently buffering media quality.
     * This is set immediately before a segment of a new quality is appended.
     *
     * Listen to {@link BufferingControllerEventMap.bufferingQualityChange} events for changes.
     */
    readonly bufferingQuality: MediaQualityMetadata | null

    /**
     * The currently playing media quality.
     *
     * Listen to {@link BufferingControllerEventMap.playbackQualityChange} events for changes.
     */
    readonly playbackQuality: MediaQualityMetadata | null

    /**
     * True if this buffering controller is active.
     */
    readonly active: boolean

    /**
     * True if the stream has buffered the last segment.
     */
    readonly bufferingEnded: boolean

    /**
     * Begins buffering.
     */
    activate(): void

    /**
     * Stops buffering.
     */
    deactivate(): void

    /**
     * If this controller is in an error state, resets and tries again.
     */
    reset(): void
}

/**
 * The measured source buffer quotas.
 */
const sourceBufferQuotas = new Map<string, number>()

/**
 * Clears the current estimated source buffer quota.
 * @private
 */
export function clearSourceBufferQuota() {
    sourceBufferQuotas.clear()
}

/**
 * Returns the measured source buffer quota for the given content type.
 * Will return null if the quota was never reached.
 *
 * @param contentType
 */
export function getSourceBufferQuota(contentType: ContentType): number | null {
    return sourceBufferQuotas.get(contentType) ?? null
}

export interface BufferingControllerImplDeps {
    readonly mediaSourceController: MediaSourceController
    readonly segmentController: ReadonlySegmentController
    readonly playbackController: ReadonlyPlaybackController
    readonly sourceBufferControllerFactory: () => SourceBufferController
}
export interface BufferingControllerImplOptions {
    /**
     * When the buffer falls below this time threshold, the next segment will be requested from the
     * segment controller and appended.
     * Default: 4s
     */
    readonly minBuffer: number

    /**
     * The maximum number of bytes to append at a time per content type.
     * Default: { audio: 1MiB, video: 15MiB }
     */
    readonly maxAppendSize: Partial<Record<ContentType, number>>
}

const defaultBufferingControllerOptions = {
    minBuffer: 4.0,
    maxAppendSize: {
        audio: 10485760, // 10 * 1024 * 1024
        video: 157286400, // 150 * 1024 * 1024
    },
} as const satisfies BufferingControllerImplOptions

/**
 * The buffering controller is responsible for requesting and appending segments to the source
 * buffer controller.
 */
export class BufferingControllerImpl
    extends EventHostImpl<BufferingControllerEventMap>
    implements BufferingController, Disposable
{
    get [Symbol.toStringTag](): string {
        return 'BufferingControllerImpl'
    }

    readonly options: BufferingControllerImplOptions
    private readonly mediaSourceController: MediaSourceController
    private readonly playbackController: ReadonlyPlaybackController
    private readonly segmentController: ReadonlySegmentController

    private sourceBufferController: SourceBufferController | null = null
    private decoderId: string | null = null

    /**
     * The currently buffered segments.
     */
    private buffered = new LinkedList<SegmentReference<ArrayBuffer>>()
    private appendOffset = 0

    /**
     * The currently buffering quality.
     */
    private _bufferingQuality: MediaQualityMetadata | null = null

    /**
     * If true and in a bufferingEnded state, the segment provider will be queried again.
     * This will be set to true after the segment controller reports a change event, indicating that there may be new
     * segments to append.
     */
    private reopen = false
    private _error: Error | null = null
    private _bufferingEnded = false

    private readonly queue = createTaskQueue()

    private disposer = createDisposer()
    private _active = false
    private activateDisposer: Disposer | null = null

    private readonly segmentAbort = createAbortSlot()

    constructor(
        readonly deps: BufferingControllerImplDeps,
        readonly contentType: ContentType,
        options?: Partial<BufferingControllerImplOptions>
    ) {
        super()
        this.options = {
            ...defaultBufferingControllerOptions,
            ...options,
        }
        logDebug(this, 'constructed', this.options)
        this.mediaSourceController = deps.mediaSourceController
        this.playbackController = deps.playbackController
        this.segmentController = deps.segmentController
    }

    get active(): boolean {
        return this._active
    }

    /**
     * Activates the buffering controller, watching the playhead and segment controller.
     */
    activate() {
        if (this._active) return
        this._active = true
        logDebug(this, 'activate')
        this.activateDisposer = createDisposer()
        const { add } = this.activateDisposer
        this.sourceBufferController = add(
            this.deps.sourceBufferControllerFactory()
        )
        add(this.playbackController.on('timeUpdate', this.pollBuffer))
        add(
            this.playbackController.on('seeking', () => {
                this.clear()
            })
        )

        const onMediaSourceOpen = () => {
            logDebug(this, 'media source opened')
            this.pollBufferImmediate()
        }
        if (this.mediaSourceOpen) {
            onMediaSourceOpen()
        } else {
            add(this.mediaSourceController.on('sourceOpen', onMediaSourceOpen))
        }
        add(
            this.segmentController.on('change', () => {
                this.reopen = true
                this.pollBufferImmediate()
            })
        )
    }

    deactivate() {
        if (!this._active) return
        logDebug(this, 'deactivate')
        this.abortCurrentSegment()
        this.resetBufferedState()
        this.activateDisposer!.dispose()
        this.activateDisposer = null
        this.sourceBufferController = null
        this._active = false
    }

    reset(): void {
        if (!this._error) {
            logDebug(this, 'reset no-op')
            return
        }
        logDebug(this, 'reset')
        this._error = null
        this.pollBufferImmediate()
    }

    /**
     * Returns true if there are active operations.
     */
    get busy(): boolean {
        return this.queue.running > 0
    }

    /**
     * Resets the throttle and polls the buffer on the next frame.
     */
    private pollBufferImmediate = () => {
        this.pollBuffer.reset()
        setTimeout(() => {
            if (this.active) this.pollBuffer()
        })
    }

    /**
     * If buffered time reaches below minBuffer, request the segment for the next unbuffered
     * time and append.
     * @private
     */
    private readonly pollBuffer = this.disposer.add(
        throttle(
            () => {
                const time = this.playbackController.currentTime
                if (getLogLevel() === LogLevel.VERBOSE) {
                    logVerbose(
                        this,
                        `pollBuffer time: ${time}, bufferedTime: ${this.getBufferedTime()}, busy: ${this.busy}, error: ${this.error != null}, readyState: ${this.mediaSourceController.readyState}`
                    )
                }
                this.refreshHead()
                if (!this.shouldAppend()) return
                this.reopen = false
                this.queue
                    .enqueue(() => this.appendNext())
                    .catch(this.handleError)
                    // An append has finished. Poll again on the next frame.
                    // The append either completed successfully, erred fatally (setting an error state),
                    // or erred silently (an abort).
                    .finally(this.pollBufferImmediate)
            },
            POLL_BUFFER_THROTTLE,
            {
                leading: true,
                trailing: true,
            }
        )
    )

    private shouldAppend(): boolean {
        return (
            this.active &&
            !this.busy &&
            !this.error &&
            !this.mediaSourceClosed &&
            (!this.bufferingEnded || this.reopen) &&
            // Return true if the current buffer is less than the minimum buffer and the playhead has not reached duration.
            this.getBufferedTime() <= this.options.minBuffer
        )
    }

    /**
     * The buffered segment at the playhead.
     */
    private get head(): SegmentReference<ArrayBuffer> | undefined {
        return this.buffered.head?.value
    }

    /**
     * The most recently buffered segment.
     */
    private get tail(): SegmentReference<ArrayBuffer> | undefined {
        return this.buffered.tail?.value
    }

    protected async appendNext(): Promise<void> {
        logVerbose(this, 'appendNext')
        const sourceBufferController = this.sourceBufferController!
        const time = this.playbackController.currentTime

        const tail = this.tail
        let streamingSegment: SegmentReference<ArrayBuffer> | null
        // If appendOffset is less than the last buffered segment size, this indicates a partial append, continue
        // buffering the last segment.
        if (tail && this.appendOffset < tail.data.byteLength) {
            streamingSegment = tail
        } else {
            streamingSegment = await this.segmentController.getSegment(
                // If buffering is a continuation from the previous segment, use its end time.
                // Otherwise, start streaming from slightly behind the playhead.
                tail?.endTime ?? time - SEGMENT_START_AFFORDANCE,
                this.segmentAbort.value
            )
            logVerbose(this, 'streamingSegment', streamingSegment)
            if (streamingSegment) this.appendOffset = 0
        }
        if (!streamingSegment) {
            await sourceBufferController.enqueue(() => {
                if (this.mediaSourceOpen) this.endBuffering()
            })
            return
        }
        this.bufferingQuality = streamingSegment.quality
        if (this.decoderId !== streamingSegment.quality.decoderId) {
            // Append the initialization segment before the media segment if the decoder
            // needs (re)-initialization.
            this.decoderId = null
            await sourceBufferController.appendInit(
                streamingSegment.initData,
                streamingSegment.quality.mimeType!
            )
            this.decoderId = streamingSegment.quality.decoderId
        }
        // Set the timestamp offset only if appending from an unbuffered position.
        if (!tail) {
            await sourceBufferController.setTimestampOffset(
                streamingSegment.timestampOffset
            )
        }

        const maxAppendSize = this.getMaxAppendSize(
            streamingSegment.quality.contentType!
        )

        const currentBitrate =
            streamingSegment.data.byteLength /
            (streamingSegment.endTime - streamingSegment.startTime)
        const appendSize =
            maxAppendSize - currentBitrate * this.getBufferedTime()
        if (appendSize <= 0) {
            // current buffered data is filling entire quota
            return
        }

        const byteLength = streamingSegment.data.byteLength
        if (byteLength > appendSize) {
            const newOffset = this.appendOffset + appendSize
            const chunk = streamingSegment.data.slice(
                this.appendOffset,
                newOffset
            )
            await sourceBufferController.append(chunk)
            if (this.appendOffset === 0) {
                this.buffered.push(streamingSegment)
            }
            this.appendOffset = newOffset
            logVerbose(
                this,
                `appended chunk, this.appendOffset: ${this.appendOffset}`
            )
        } else {
            await sourceBufferController.append(streamingSegment.data)
            this.appendOffset = streamingSegment.data.byteLength
            this.buffered.push(streamingSegment)
        }
        if (!tail) this.refreshHead() // Update quality immediately if buffer was empty
    }

    private abortCurrentSegment() {
        this.segmentAbort.abort()
    }

    /**
     * Checks if the playhead has progressed past the current head segment and shifts the linked list.
     * Updates the playback quality if changed.
     */
    private refreshHead() {
        const head = this.head
        const tail = this.tail
        const time = this.playbackController.currentTime
        if (head && time >= head.endTime && head !== tail) {
            // The playhead has passed the end of the head segment.
            this.buffered.shift()
        }
        this.playbackQuality = this.head?.quality ?? null
    }

    private getMaxAppendSize(contentType: ContentType): number {
        const maxAppendSize =
            this.options.maxAppendSize[contentType] ?? DEFAULT_MAX_APPEND_SIZE
        const sourceBufferQuota = sourceBufferQuotas.get(contentType)
        return sourceBufferQuota == null
            ? maxAppendSize
            : Math.min(sourceBufferQuota, maxAppendSize)
    }

    private _playbackQuality: MediaQualityMetadata | null = null

    get playbackQuality(): MediaQualityMetadata | null {
        return this._playbackQuality
    }

    /**
     * Returns the quality currently buffering.
     */
    get bufferingQuality(): MediaQualityMetadata | null {
        return this._bufferingQuality
    }

    private set bufferingQuality(value: MediaQualityMetadata | null) {
        const previous = this._bufferingQuality
        if (value?.qualityId === previous?.qualityId) return
        this._bufferingQuality = value
        logDebug(this, 'bufferingQualityChange', value)
        this.dispatch('bufferingQualityChange', {
            previous,
            current: value,
        })
    }

    /**
     * Sets the current playback quality and emits a playbackQualityChange event.
     * No-ops if quality id has not changed.
     */
    private set playbackQuality(value: MediaQualityMetadata | null) {
        const previous = this._playbackQuality
        if (value?.qualityId === previous?.qualityId) return
        this._playbackQuality = value
        logDebug(this, 'playbackQualityChange', value)
        this.dispatch('playbackQualityChange', {
            previous,
            current: value,
        })
    }

    /**
     * The last error emitted.
     * Buffering will halt if this controller is in an error state.
     * Deactivating this controller will reset the error state.
     */
    get error(): Error | null {
        return this._error
    }

    /**
     * Returns true if the media source's ready state is 'open'
     */
    private get mediaSourceOpen(): boolean {
        return this.mediaSourceController.readyState === 'open'
    }

    /**
     * Returns true if the media source's ready state is 'closed'
     */
    private get mediaSourceClosed(): boolean {
        return this.mediaSourceController.readyState === 'closed'
    }

    /**
     * Returns true if the last segment has been appended.
     */
    get bufferingEnded(): boolean {
        return this._bufferingEnded
    }

    private readonly handleError = (error: Error) => {
        if ('name' in error && error.name === 'QuotaExceededError') {
            const contentType = this.bufferingQuality?.contentType
            if (contentType) {
                const newAppendSize =
                    this.getMaxAppendSize(contentType) * QUOTA_REACHED_SCALE
                if (newAppendSize >= MIN_APPEND_SIZE) {
                    sourceBufferQuotas.set(contentType, newAppendSize)
                    logWarn(
                        this,
                        'QuotaExceededError, new source buffer limit:',
                        (newAppendSize / 1024 / 1024).toFixed(1) + ' MiB'
                    )
                    const sourceBufferController = this.sourceBufferController
                    if (sourceBufferController) {
                        this.clear()
                    }
                    return // If the quota size was successfully reduced, do not err and try again.
                }
            }
        }
        if (this.tryCodecFallback(error)) {
            // The failing codec was denylisted and playback will retry with a
            // different quality; do not enter an error state.
            return
        }
        if (!isSilentError(error)) {
            // Set this controller to an error state. If in an error state, buffering will
            // not continue.
            this._error = error
            this.dispatch('error', {
                target: this,
                error,
            })
        }
    }

    /**
     * Attempts to recover from a SourceBuffer decode/append failure caused by a
     * codec the browser reported as supported but cannot actually decode.
     *
     * Denylists the failing quality's codec so subsequent quality selection
     * avoids it, then clears and retries. Returns true when a fallback was
     * initiated (the caller should not enter an error state), false otherwise.
     *
     * Guards against loops: recovery only proceeds when the codec was newly
     * denylisted. A repeat failure for an already-denylisted codec (e.g. a
     * single-codec stream with no alternative) returns false and falls through
     * to the normal error path, so playback errors out rather than looping.
     */
    private tryCodecFallback(error: Error): boolean {
        if (!(error instanceof SourceBufferError)) return false
        const quality = this.bufferingQuality
        const mimeType = quality?.mimeType
        const contentType = quality?.contentType
        if (!mimeType || !contentType) return false
        // denylistCodecsFromMimeType returns false if all codecs were already
        // denylisted, which bounds recovery to one attempt per codec.
        if (!denylistCodecsFromMimeType(mimeType)) return false
        logWarn(
            this,
            'SourceBuffer append failed; denylisting codec and requesting reload:',
            mimeType
        )
        // A decode failure poisons the MediaSource, so in-place recovery is not
        // possible. Signal a recoverable codec failure; the player reloads the
        // track, and the denylist steers selection to a codec that decodes.
        this.dispatch('codecUnsupported', { mimeType, contentType })
        return true
    }

    /**
     * Returns the amount of time buffered at the current media position.
     * @private
     */
    getBufferedTime(): number {
        if (!this.active) return 0
        const time = this.playbackController.currentTime
        const range = this.sourceBufferController!.buffered.getRangeAt(time)
        if (!range) return 0
        return range[1] - time
    }

    /**
     * Cancels any currently buffering fragments and clears the source buffer.
     */
    clear(): void {
        if (!this.active) return
        logDebug(this, 'clear')
        this.abortCurrentSegment()
        // Enqueue clearing the buffer and buffered list.
        this.queue
            .enqueue(this.finishAndClearBuffers)
            .catch(this.handleError)
            .finally(() => {
                this.resetBufferedState()
                this.pollBufferImmediate()
            })
    }

    private endBuffering(): void {
        logDebug(this, 'bufferingEnded')
        this._bufferingEnded = true
        this.bufferingQuality = null
        this.dispatch('bufferingEnded', {})
    }

    private resetBufferedState() {
        this.decoderId = null
        this.appendOffset = 0
        this.buffered.clear()
        this._bufferingEnded = false
        this.bufferingQuality = null
        this.playbackQuality = null
    }

    /**
     * Finish any partial appends and clear the source buffer.
     */
    private finishAndClearBuffers = async () => {
        if (!this.active) return
        logVerbose(this, 'finishAndClearBuffers')
        await this.sourceBufferController!.clear()
        logVerbose(this, 'finishAndClearBuffers complete')
    }

    get disposed(): boolean {
        return this.disposer.disposed
    }

    dispose() {
        this.deactivate()
        super.dispose()
        this.disposer.dispose()
    }
}
