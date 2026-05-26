/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type AnyRecord,
    createDisposer,
    type Disposable,
    DomEventHost,
    ErrorLevel,
    ErrorOrigin,
    EventHostImpl,
    type Json,
    logDebug,
    type LogTarget,
    type ReadonlyEventHost,
    type ReadonlySet,
    ReportableError,
    toJson,
    toLowerCase,
} from '@amazon/vinyl-util'
import type { ContentTypesValue } from '@/streaming/ContentTypesValue'
import type { BasicErrorEvent } from '@/event/BasicErrorEvent'
import type { ContentType } from '@/streaming/MediaQualityMetadata'

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
     * All source buffers have been created and data may be appended.
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
     * Gets the media source's duration.
     */
    readonly duration: number

    /**
     * True if all source buffers have been created and data may be appended.
     */
    readonly readyToAppend: boolean
}

export interface MediaSourceController extends ReadonlyMediaSourceController {
    /**
     * Sets/gets the media source's duration.
     */
    duration: number

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
}

export class MediaSourceControllerImpl
    extends EventHostImpl<MediaSourceControllerEventMap>
    implements MediaSourceController, LogTarget
{
    get [Symbol.toStringTag](): string {
        return 'MediaSourceControllerImpl'
    }

    private sourceBufferCount = 0

    private readonly mediaSource: MediaSource
    private readonly disposer = createDisposer()
    private contentTypes: ReadonlySet<ContentType> | null = null

    constructor(deps: MediaSourceControllerImplDeps) {
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
                    .catch((error) => {
                        this.dispatch('error', {
                            target: this,
                            error: error,
                        })
                    })
            })
        )
    }

    private initializeEvents(): void {
        const domEvents = new DomEventHost<MediaSourceEventMap>(
            this.mediaSource
        )
        // Re-dispatch html media element events exposed on the playback controller as empty events.
        for (const key of [
            'sourceClose',
            'sourceOpen',
            'sourceEnded',
        ] as const) {
            domEvents.on(toLowerCase(key), () => this.dispatch(key, {}))
        }
    }

    get duration(): number {
        return this.mediaSource.duration
    }

    set duration(value: number) {
        this.mediaSource.duration = value
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
        ++this.sourceBufferCount
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
            --this.sourceBufferCount
        }

        return {
            value: sourceBuffer,
            dispose,
        }
    }

    /**
     * Emits a 'readyToAppend' event if all source buffers have been created.
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
        return this.contentTypes?.size === this.sourceBufferCount
    }

    dispose() {
        super.dispose()
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
