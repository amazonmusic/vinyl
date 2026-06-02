/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type AnyRecord,
    closeTo,
    createDisposer,
    type Disposable,
    DomEventHost,
    ErrorLevel,
    ErrorOrigin,
    EventHostImpl,
    isSilentError,
    type Json,
    logDebug,
    type LogTarget,
    type ReadonlyEventHost,
    type ReadonlySet,
    ReportableError,
    toJson,
    toLowerCase,
} from '@amazon/vinyl-util'
import type { ObservableValue } from '@amazon/vinyl-observable'
import type { ContentTypesValue } from '../ContentTypesValue'
import type { BasicErrorEvent } from '../../event/BasicErrorEvent'
import type { ContentType } from '../MediaQualityMetadata'
import type { MediaTimeline } from '../MediaTimeline'
import { LIVE_DURATION } from '../../playback/PlaybackController'
import { nextSourceBufferIdle } from '../../util/media/sourceBuffer'

/**
 * Chrome 52 has decoding errors when duration is set to the mediaPresentationDuration.
 * Adds a slight padding as a workaround.
 * @private
 */
export const DURATION_PADDING = 0.1

export interface SourceBufferRef extends Disposable {
    /**
     * The source buffer.
     */
    readonly value: SourceBuffer
}

export interface MediaSourceControllerEventMap {
    /**
     * The media source has entered a 'closed' state.
     */
    readonly sourceClose: AnyRecord

    /**
     * The media source has entered an 'ended' state.
     */
    readonly sourceEnded: AnyRecord

    /**
     * The media source has entered an 'open' state.
     */
    readonly sourceOpen: AnyRecord

    /**
     * All source buffers have been created, the media source duration has been set, and data
     * may be appended.
     */
    readonly readyToAppend: AnyRecord

    /**
     * An error has occurred.
     */
    readonly error: BasicErrorEvent
}

export interface ReadonlyMediaSourceController extends ReadonlyEventHost<MediaSourceControllerEventMap> {
    /**
     * Returns the parent media source ready state.
     */
    readonly readyState: ReadyState

    /**
     * True if all source buffers have been created and data may be appended.
     */
    readonly readyToAppend: boolean
}

export interface MediaSourceController extends ReadonlyMediaSourceController {
    /**
     * Constructs a new SourceBuffer with the given content type and mime type.
     */
    createSourceBuffer(
        contentType: ContentType,
        mimeType: string
    ): SourceBufferRef

    /**
     * Signals the end of the stream.
     * @param error A string representing an error to throw when the end of the stream is reached.
     */
    endOfStream(error?: EndOfStreamError): void

    /**
     * Creates an Object URL to use as the source for this stream.
     */
    createUrl(): string
}

export interface MediaSourceControllerImplDeps {
    /**
     * Creates a new media source.
     */
    readonly mediaSourceFactory: () => MediaSource

    /**
     * Provides the streams that must be created before appending.
     */
    readonly contentTypesValue: ContentTypesValue

    /**
     * The media timeline used to determine duration.
     */
    readonly mediaTimelineTransformed: ObservableValue<Promise<MediaTimeline>>
}

export class MediaSourceControllerImpl
    extends EventHostImpl<MediaSourceControllerEventMap>
    implements MediaSourceController, LogTarget
{
    get [Symbol.toStringTag](): string {
        return 'MediaSourceControllerImpl'
    }

    private readonly sourceBuffers = new Set<SourceBuffer>()

    private readonly mediaSource: MediaSource
    private readonly disposer = createDisposer()
    private contentTypes: ReadonlySet<ContentType> | null = null
    private durationSet = false

    /**
     * Token for the in-flight duration update; used to discard stale results when
     * the timeline changes or the source closes mid-fetch.
     */
    private durationToken = 0

    constructor(private readonly deps: MediaSourceControllerImplDeps) {
        super()
        this.mediaSource = deps.mediaSourceFactory()
        this.initializeEvents()
        this.disposer.add(
            deps.contentTypesValue.onData((value) => {
                this.contentTypes = null
                value
                    .then((contentTypes) => {
                        this.contentTypes = contentTypes
                        this.checkReady()
                    })
                    .catch(this.errorHandler)
            })
        )
    }

    private get sourceBufferCount(): number {
        return this.sourceBuffers.size
    }

    private readonly errorHandler = (error: any) => {
        if (isSilentError(error)) return
        this.dispatch('error', {
            target: this,
            error,
        })
    }

    /**
     * Subscription to mediaTimelineTransformed; only attached while the media source is open
     * so the timeline pipeline isn't forced to evaluate before the source has opened.
     */
    private timelineSub: (() => void) | null = null

    private initializeEvents(): void {
        const domEvents = new DomEventHost<MediaSourceEventMap>(
            this.mediaSource
        )
        for (const key of [
            'sourceClose',
            'sourceOpen',
            'sourceEnded',
        ] as const) {
            domEvents.on(toLowerCase(key), () => this.dispatch(key, {}))
        }
        this.timelineSub = this.deps.mediaTimelineTransformed.onData(() => {
            this.refreshDuration().catch(this.errorHandler)
        })
        this.on('sourceOpen', () => {
            this.refreshDuration().catch(this.errorHandler)
        })
        this.on('sourceClose', () => {
            this.durationSet = false
            ++this.durationToken
        })
    }

    /**
     * Sets the duration on the media source from the current media timeline.
     * Live streams use LIVE_DURATION since not all browsers support +Infinity duration.
     *
     * MSE throws InvalidStateError if duration is set while any source buffer is updating,
     * so we wait for all tracked source buffers to be idle first.
     */
    private async refreshDuration(): Promise<void> {
        const timelinePromise = this.deps.mediaTimelineTransformed.value
        const token = ++this.durationToken
        const timeline = await timelinePromise
        const duration = await timeline.getDuration()
        const value =
            duration === Infinity ? LIVE_DURATION : duration + DURATION_PADDING
        await Promise.all(Array.from(this.sourceBuffers, nextSourceBufferIdle))
        if (
            token !== this.durationToken ||
            this.mediaSource.readyState !== 'open' ||
            closeTo(this.mediaSource.duration, value, 0.1)
        )
            return
        logDebug(this, `setting duration: ${value}`)
        this.mediaSource.duration = value
        this.durationSet = true
        this.checkReady()
    }

    get readyState(): ReadyState {
        return this.mediaSource.readyState
    }

    createSourceBuffer(
        contentType: ContentType,
        mimeType: string
    ): SourceBufferRef {
        const mediaSource = this.mediaSource
        logDebug(
            this,
            'create source buffer',
            contentType,
            mimeType,
            mediaSource.readyState,
            'sourceBufferCount:',
            this.sourceBufferCount
        )
        let sourceBuffer: SourceBuffer
        try {
            sourceBuffer = mediaSource.addSourceBuffer(mimeType)
        } catch (error: any) {
            throw new MediaSourceError('error creating source buffer', error)
        }
        sourceBuffer.mode = 'sequence'
        this.sourceBuffers.add(sourceBuffer)
        this.checkReady()

        const dispose = () => {
            logDebug(
                this,
                'removing source buffer from media source',
                mediaSource.readyState
            )
            if (mediaSource.readyState !== 'closed') {
                mediaSource.removeSourceBuffer(sourceBuffer)
            }
            this.sourceBuffers.delete(sourceBuffer)
        }

        return {
            value: sourceBuffer,
            dispose,
        }
    }

    /**
     * Emits a 'readyToAppend' event if all source buffers have been created and the duration
     * has been applied to the media source.
     */
    private readonly checkReady = () => {
        if (this.readyToAppend) this.dispatch('readyToAppend', {})
    }

    endOfStream(error?: EndOfStreamError) {
        logDebug(this, 'endOfStream, error:', error)
        this.mediaSource.endOfStream(error)
    }

    createUrl(): string {
        return URL.createObjectURL(this.mediaSource)
    }

    get readyToAppend(): boolean {
        return (
            this.durationSet &&
            this.contentTypes?.size === this.sourceBufferCount
        )
    }

    dispose() {
        super.dispose()
        this.timelineSub?.()
        this.timelineSub = null
        this.disposer.dispose()
    }
}

export class MediaSourceError extends ReportableError {
    get [Symbol.toStringTag](): string {
        return 'MediaSourceError'
    }

    constructor(
        message: string,
        private readonly reason: Error
    ) {
        super(message, ErrorOrigin.INTERNAL, ErrorLevel.FATAL)
        Object.setPrototypeOf(this, MediaSourceError.prototype)
    }

    toJSON(): Json {
        return {
            ...super.toJSON(),
            reason: toJson(this.reason),
        }
    }
}
