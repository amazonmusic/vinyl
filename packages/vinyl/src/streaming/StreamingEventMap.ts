/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChangeEvent } from '@/event/ChangeEvent'
import type {
    ContentType,
    MediaQualityMetadata,
} from '@/streaming/MediaQualityMetadata'
import type { BasicErrorEvent } from '@/event/BasicErrorEvent'
import type { AnyRecord } from '@amazon/vinyl-util'

/**
 * Events a track dispatches related to streaming quality and status.
 */
export interface StreamingEventMap {
    /**
     * The actively streamed content types have changed.
     */
    readonly contentTypesChange: ChangeEvent<ReadonlySet<ContentType>>

    /**
     * fetchedRanges have been updated.
     */
    readonly fetchedRangesChange: AnyRecord

    /**
     * Dispatched when the currently streaming quality changes.
     * This is dispatched when a new streaming quality has been requested.
     */
    readonly streamingQualityChange: ChangeEvent<MediaQualityMetadata | null>

    /**
     * Dispatched when the currently buffering quality changes.
     * This is dispatched before the segment is appended.
     */
    readonly bufferingQualityChange: ChangeEvent<MediaQualityMetadata | null>

    /**
     * The currently playing quality has changed.
     */
    readonly playbackQualityChange: ChangeEvent<MediaQualityMetadata | null>

    /**
     * The last segment has finished appending.
     */
    readonly bufferingEnded: AnyRecord

    /**
     * Dispatched when a streaming error occurs.
     */
    readonly error: BasicErrorEvent

    /**
     * Emitted when the error state has been reset.
     */
    readonly reset: AnyRecord

    /**
     * The available qualities for the current period have changed.
     */
    readonly qualitiesChange: ChangeEvent<readonly MediaQualityMetadata[]>

    /**
     * The available unfiltered qualities for the current period have changed.
     */
    readonly qualitiesUnfilteredChange: ChangeEvent<
        readonly MediaQualityMetadata[]
    >
}

/**
 * All streaming-related events a track may emit.
 * These will be bubbled by the player.
 */
export const ALL_STREAMING_EVENTS = [
    'contentTypesChange',
    'fetchedRangesChange',
    'streamingQualityChange',
    'bufferingQualityChange',
    'playbackQualityChange',
    'bufferingEnded',
    'error',
    'reset',
    'qualitiesChange',
    'qualitiesUnfilteredChange',
] as const satisfies readonly (keyof StreamingEventMap)[]
