/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Task, TaskQueue } from '@amazon/vinyl-util'
import {
    type Comparator,
    compareBy,
    createTaskQueue,
    globalRef,
} from '@amazon/vinyl-util'
import type { ContentType } from './MediaQualityMetadata'

/**
 * Properties affecting segment prefetch priority.
 * Each track when prefetching will only add one segment to the prefetch queue at a time.
 */
export interface SegmentPrefetchPriority {
    /**
     * The track's prefetch priority.
     */
    readonly trackPriority: number

    /**
     * The starting time of the segment.
     */
    readonly segmentStartTime: number

    /**
     * The time position prefetching starts for this segment's track.
     */
    readonly prefetchStartTime: number
}

export const defaultTrackPriority = {
    // Default priority is lowest, but not used. Use enqueueSegmentPrefetch to enqueue.
    trackPriority: 0,
    segmentStartTime: 9007199254740991, // Number.MAX_SAFE_INTEGER,
    prefetchStartTime: 0,
} as const satisfies SegmentPrefetchPriority

/**
 * Highest priority; used to block prefetching while an actively-needed operation is enqueued.
 */
export const immediatePrefetchPriority = {
    trackPriority: 9007199254740991, // Number.MAX_SAFE_INTEGER,
    segmentStartTime: 0,
    prefetchStartTime: 0,
}

/**
 * A comparator for segment prefetching.
 * Given tracks A, B, and C with track priorities 1, 2, and 3 respectively:
 * The expected prefetch order will be:
 *
 * A0
 * B0 // "lean forward" case
 * C0 // "lean forward" case
 * A1 ... An
 * B1 ... Bn
 * C1 ... Cn
 *
 * Note that background prefetching is in parallel to prefetching for the active track.
 */
export const segmentPriorityComparatorRef = globalRef<
    Comparator<SegmentPrefetchPriority>
>(() => {
    return compareBy(
        (e) => {
            // First segments always take priority over subsequent ones.
            return e.segmentStartTime <= e.prefetchStartTime ? 0 : 1
        },
        // Next, consider track priority.
        (e) => -e.trackPriority
    )
})

// Task queues for each content type
export const prefetchPriorityQueuesRef = globalRef<
    Record<ContentType, TaskQueue<SegmentPrefetchPriority>>
>(() => {
    return {
        video: createTaskQueue<SegmentPrefetchPriority>(
            segmentPriorityComparatorRef.value,
            defaultTrackPriority
        ),
        audio: createTaskQueue<SegmentPrefetchPriority>(
            segmentPriorityComparatorRef.value,
            defaultTrackPriority
        ),
        text: createTaskQueue<SegmentPrefetchPriority>(
            segmentPriorityComparatorRef.value,
            defaultTrackPriority
        ),
    }
})

/**
 * Enqueues a task to request a streaming segment for a specific content type.
 * This should only be used for low priority background requests. Active tracks should request without
 * prioritization for the immediately needed segment.
 * Tracks are expected to prefetch one segment at a time, in order.
 *
 * @param requestTask
 * @param contentType
 * @param priority
 */
export function enqueueSegmentPrefetch(
    requestTask: Task<any>,
    contentType: ContentType,
    priority: SegmentPrefetchPriority
): Promise<void> {
    return prefetchPriorityQueuesRef.value[contentType].enqueue(
        requestTask,
        priority
    )
}
