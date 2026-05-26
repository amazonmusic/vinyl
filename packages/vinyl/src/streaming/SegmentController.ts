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

/**
 * Forward-snap tolerance, in seconds, applied when looking up a segment by time.
 *
 * If the requested time falls within this window before a segment's `startTime`,
 * that segment is returned rather than treating the gap as uncovered. This absorbs
 * small alignment differences between qualities, where one quality's segment may
 * begin a few milliseconds later than another's at the same logical boundary.
 *
 * Pass to `getSegmentAtTime` (and `MediaQualityData.getSegment`) as the `affordance`
 * argument. Callers resuming streaming after a seek should also bias the requested
 * time *behind* the playhead by at least this amount, so any subsequent appends
 * cover the playhead without leaving a gap. The `SegmentController` clamps negative
 * request times to `0`, so callers don't need to guard against the bias going below
 * the start of the timeline.
 */
export const SEGMENT_START_AFFORDANCE = 0.2

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
export interface ReadonlySegmentController extends ReadonlyEventHost<SegmentControllerEventMap> {
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
     * Returns a Promise for a segment covering the given time, with quality chosen by
     * the configured `QualitySelector`. Resolves to `null` if no media exists at that
     * time. Negative `time` values are clamped to `0`.
     *
     * The lookup forward-snaps by `SEGMENT_START_AFFORDANCE`: if `time` falls within
     * that window before a segment's `startTime`, that segment is returned. This
     * absorbs sub-second segment-boundary differences across qualities so an ABR
     * switch doesn't replay or skip media at the boundary.
     *
     * Calling this also blocks the prefetch queue until the returned promise settles,
     * so the active request is prioritized over background prefetching.
     *
     * @param time The time, in seconds, the requested segment should span.
     * @param abort Aborts the returned promise (rejecting with `AbortError`) and
     * releases the prefetch-queue lock. The underlying network request may continue
     * so its result can still populate the cache.
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
    extends ReadonlySegmentController, Disposable {
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
