/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createDisposer,
    type Disposable,
    EventHostImpl,
    type Maybe,
    type ReadonlyEventHost,
    type ReadonlyRanges,
    redispatchEvents,
} from '@amazon/vinyl-util'
import type { StreamingEventMap } from '@/streaming/StreamingEventMap'
import type { SegmentController } from '@/streaming/SegmentController'
import type { BufferingController } from '@/streaming/buffering/BufferingController'
import type {
    ContentType,
    MediaQualityMetadata,
} from '@/streaming/MediaQualityMetadata'
import { createContainer, type Factories } from '@amazon/vinyl-di'

/**
 * Creates a new ContentStream for the given content type.
 */
export type ContentStreamFactory = (contentType: ContentType) => ContentStream

export interface ContentStream
    extends ReadonlyEventHost<StreamingEventMap>, Disposable {
    /**
     * The content type for this stream.
     * E.g. 'audio' or 'video'
     */
    readonly contentType: ContentType

    /**
     * The prefetched time ranges.
     */
    readonly fetchedRanges: ReadonlyRanges

    /**
     * The quality currently being requested.
     */
    readonly streamingQuality: MediaQualityMetadata | null

    /**
     * The quality of the currently buffered media for this stream.
     */
    readonly bufferingQuality: MediaQualityMetadata | null

    /**
     * The quality for the currently buffered media at currentTime for this stream.
     */
    readonly playbackQuality: MediaQualityMetadata | null

    /**
     * The error, if in an error state.
     */
    readonly error: Error | null

    /**
     * True if the last segment has been appended.
     */
    readonly bufferingEnded: boolean

    /**
     * Starts prefetching with the given priority and prefetch start time.
     * @param options
     */
    preload(options: ContentStreamPreloadOptions): void

    clearPrefetch(): void

    /**
     * Resets the track to recover from error states.
     * Resets both the segment controller and buffering controller to clear failed segments and error conditions.
     */
    reset(): void

    /**
     * Activates the content stream, activating sub-controllers.
     */
    activate(options: ContentStreamActivateOptions): void

    /**
     * Deactivates the content stream, deactivating sub-controllers.
     */
    deactivate(): void
}

export interface ContentStreamPreloadOptions {
    /**
     * Track priority for prefetching.
     * Higher values take precedence.
     */
    readonly prefetchPriority: number

    /**
     * The media presentation time (in seconds) to begin prefetching.
     */
    readonly startTime?: Maybe<number>
}

export interface ContentStreamActivateOptions {
    /**
     * The media presentation time (in seconds) to seek to.
     */
    readonly startTime?: Maybe<number>
}

export interface ContentStreamImplDeps {
    readonly bufferingController: BufferingController
    readonly segmentController: SegmentController
}

export class ContentStreamImpl
    extends EventHostImpl<StreamingEventMap>
    implements ContentStream
{
    private disposer = createDisposer()
    private readonly segmentController: SegmentController
    private readonly bufferingController: BufferingController

    constructor(
        dependencyFactories: Factories<ContentStreamImplDeps>,
        readonly contentType: ContentType
    ) {
        super()
        const { add } = this.disposer
        const deps = add(createContainer(dependencyFactories)).dependencies

        this.segmentController = deps.segmentController
        redispatchEvents(this, this.segmentController, ['fetchedRangesChange'])

        this.bufferingController = deps.bufferingController
        redispatchEvents(this, this.segmentController, [
            'streamingQualityChange',
        ])
        redispatchEvents(this, this.bufferingController, [
            'bufferingQualityChange',
            'playbackQualityChange',
            'bufferingEnded',
            'error',
        ])
    }

    preload(options: ContentStreamPreloadOptions) {
        this.segmentController.configure({
            startTime: options.startTime ?? 0,
            trackPrefetchPriority: options.prefetchPriority,
        })
    }

    get fetchedRanges(): ReadonlyRanges {
        return this.segmentController.fetchedRanges
    }

    get streamingQuality(): MediaQualityMetadata | null {
        return this.segmentController.streamingQuality ?? null
    }

    get bufferingQuality(): MediaQualityMetadata | null {
        return this.bufferingController.bufferingQuality ?? null
    }

    get playbackQuality(): MediaQualityMetadata | null {
        return this.bufferingController.playbackQuality ?? null
    }

    get bufferingEnded(): boolean {
        return this.bufferingController.bufferingEnded
    }

    get error(): Error | null {
        return this.bufferingController.error ?? this.segmentController.error
    }

    /**
     * Clears all fetched fragments and source buffers. Streaming will resume.
     * This should be called if a change has been made where the user would expect an immediate change,
     * for example, changing streaming quality from SD to HD.
     */
    clearPrefetch() {
        this.segmentController.clear()
        this.bufferingController.clear()
    }

    /**
     * Resets the track to recover from error states.
     * Resets both the segment controller and buffering controller to clear failed segments and error conditions.
     */
    reset(): void {
        this.segmentController.reset()
        this.bufferingController.reset()
    }

    activate(options: ContentStreamActivateOptions): void {
        this.segmentController.configure({
            startTime: options.startTime ?? 0,
        })
        this.segmentController.activate()
        this.bufferingController.activate()
    }

    deactivate(): void {
        this.segmentController.deactivate()
        this.bufferingController.deactivate()
    }

    dispose(): void {
        super.dispose()
        this.disposer.dispose()
    }
}

/**
 * The `Factory` to create a function which satisfies `ContentStreamFactory`.
 */
export function createContentStreamFactory(deps: {
    readonly createContentStreamFactories: (
        contentType: ContentType
    ) => Factories<ContentStreamImplDeps>
}) {
    return ((contentType: ContentType) => {
        return new ContentStreamImpl(
            deps.createContentStreamFactories(contentType),
            contentType
        )
    }) satisfies ContentStreamFactory
}
