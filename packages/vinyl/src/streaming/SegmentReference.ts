/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MediaQualityMetadata } from './MediaQualityMetadata'

export interface MediaSegmentMetadata {
    /**
     * The timestamp offset of the segment.
     * Should be used as the append timestamp offset.
     * This is in seconds, relative to the MPD timeline.
     * For example if the first segment has a timestampOffset of -2 and startTime of 0, playback will begin 2s into the
     * start of that segment.
     */
    readonly timestampOffset: number

    /**
     * The time, in seconds, to add to the segment's media timestamps to place
     * them on the presentation timeline, when the manifest defines it (DASH:
     * `Period@start − presentationTimeOffset / timescale`). Used as the
     * timestamp offset in `'segments'` append mode. When undefined, the
     * offset is anchored from the media timestamps of the first segment
     * appended in a continuous run.
     */
    readonly mediaTimeOffset?: number

    /**
     * The start time of the segment, in seconds.
     * Relative to the MPD timeline.
     * Should be used as the append window start.
     */
    readonly startTime: number

    /**
     * The end time of the segment, in seconds.
     * Relative to the MPD timeline.
     * Should be used as the append window end.
     */
    readonly endTime: number
}

export interface InitSegmentReference<T> {
    /**
     * Metadata describing the media encoding.
     */
    readonly quality: MediaQualityMetadata

    /**
     * References initialization data for this segment.
     * Must be appended before `data` if the decoderId has changed from the last buffered
     * segment.
     * This is a shared reference between other streaming segments of the same quality/representation.
     */
    readonly initData: T
}

export interface MediaSegmentReference<T> extends MediaSegmentMetadata {
    /**
     * Provides the media data.
     */
    readonly data: T
}

/**
 * A reference, with metadata, to streaming and initialization data.
 */
export interface SegmentReference<T>
    extends InitSegmentReference<T>, MediaSegmentReference<T> {}
