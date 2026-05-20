/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    AnyRecord,
    Disposable,
    ReadonlyAbort,
    ReadonlyEventHost,
    ReadonlyRanges,
} from '@amazon/vinyl-util'
import type { SegmentReference } from '@/streaming/SegmentReference'
import type { ChangeEvent } from '@/event/ChangeEvent'
import type { MediaQualityMetadata } from '@/streaming/MediaQualityMetadata'

export interface SegmentControllerEventMap {
    /**
     * fetchedRanges have been updated.
     */
    readonly fetchedRangesChange: AnyRecord

    /**
     * Emitted when the timeline has changed.
     */
    readonly change: AnyRecord

    /**
     * Dispatched when the current streaming quality changes.
     * This is dispatched when a new quality is requested.
     */
    readonly streamingQualityChange: ChangeEvent<MediaQualityMetadata | null>
}

/**
 * The SegmentController provides segments to buffer for the given time.
 * It is expected to prefetch segments based on the expectation of when the segments will be
 * needed next.
 */
export interface ReadonlySegmentController
    extends ReadonlyEventHost<SegmentControllerEventMap> {
    readonly error: Error | null

    /**
     * The time ranges currently fetched.
     */
    readonly fetchedRanges: ReadonlyRanges

    /**
     * The most recently requested quality metadata.
     */
    readonly streamingQuality: MediaQualityMetadata | null

    /**
     * The duration of the media, in seconds.
     * Returns null if duration cannot be determined.
     */
    getDuration(): Promise<number | null>

    /**
     * Returns a Promise for a segment for the given time and currently selected media.
     * The returned promise may abort with an AbortError if a seek occurs to outside the prefetch window.
     *
     * @param time The time, in seconds, the requested segment should span.
     * @param abort Aborts the returned promise and releases the lock on prefetching. The segment request will not be
     * interrupted unless the time goes out of prefetch ranges.
     */
    getSegment(
        time: number,
        abort?: ReadonlyAbort
    ): Promise<SegmentReference<ArrayBuffer> | null>
}

/**
 * Configuration the track is expected to provide to the SegmentController.
 */
export interface PrefetchOptions {
    /**
     * The prefetching priority of the track. Higher numbers take precedence.
     */
    readonly trackPrefetchPriority: number

    /**
     * When the track is inactive, the starting time to prefetch from.
     */
    readonly startTime: number
}

/**
 * Provides segments for a given time.
 * Handles segment prefetching and caching.
 */
export interface SegmentController
    extends ReadonlySegmentController,
        Disposable {
    /**
     * Configures this segment provider.
     */
    configure(options: Partial<PrefetchOptions>): void

    /**
     * Clears the cached segments.
     * Currently pending segment promises will be rejected with an abort reason.
     */
    clear(): void

    /**
     * Indicates that this segment provider is providing segments for an active track and should be prioritized
     * accordingly.
     */
    activate(): void

    /**
     * Indicates that this segment provider is providing segments for an inactive track.
     */
    deactivate(): void

    /**
     * Resets failed segments to a pending state.
     */
    reset(): void
}
