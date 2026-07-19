/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    AnyRecord,
    Disposable,
    LogTarget,
    ReadonlyEventHost,
    ReadonlyRanges,
    ReadonlySet,
} from '@amazon/vinyl-util'
import type {
    ContentType,
    MediaQualityMetadata,
} from '../streaming/MediaQualityMetadata'
import type { StreamingEventMap } from '../streaming/StreamingEventMap'
import type {
    ReadonlyTextTrackController,
    TextTrackController,
} from '../text/TextTrack'
import type { AdController, ReadonlyAdController } from '../ad/AdBreak'

/**
 * All events a track may emit.
 * Streaming-related events are separated as they will be bubbled by the player.
 */
export type TrackEventMap = StreamingEventMap

/**
 * An identifier for a Track, used for referencing a track.
 */
export type TrackUri = string

/**
 * A track type identifier. Used to match a track type to its registered factory function.
 */
export type TrackTypeId = string

/**
 * Track prefetch configuration provided by the track controller.
 */
export interface TrackPreloadOptions {
    /**
     * Track priority for prefetching.
     * Higher values take precedence.
     */
    readonly prefetchPriority: number
}

/**
 * Represents the streaming-related state for a single track.
 *
 * Provides read-only access to:
 * - The currently fetched media time ranges
 * - The current streaming, buffering, and playback quality metadata
 *
 * To observe changes over time, listen to events defined in {@link StreamingEventMap},
 * including:
 * - `streamingQualityChange`
 * - `bufferingQualityChange`
 * - `playbackQualityChange`
 */
export interface ReadonlyStreamingState extends ReadonlyEventHost<StreamingEventMap> {
    /**
     * The time ranges the track has fetched.
     * This will be a snapshot of the fetched ranges at the time this property is accessed.
     */
    readonly fetchedRanges: ReadonlyRanges

    /**
     * The current content types for the active streams, e.g. Set(['audio', 'video'])
     */
    readonly contentTypes: ReadonlySet<ContentType>

    /**
     * The available qualities for the current period, after filtering.
     * Null if the timeline is not yet available.
     */
    readonly qualities: readonly MediaQualityMetadata[] | null

    /**
     * The available unfiltered qualities for the current period.
     * Null if the timeline is not yet available.
     */
    readonly qualitiesUnfiltered: readonly MediaQualityMetadata[] | null

    /**
     * The currently streaming media quality for the given content stream.
     * This is set when a new quality is being requested.
     *
     * Quality metadata progresses as follows:
     * streamingQuality -> bufferingQuality -> playbackQuality
     *
     * Listen to {@link TrackEventMap.streamingQualityChange} events for changes.
     * @param contentType 'video' | 'audio' | 'text'
     */
    getStreamingQuality(contentType: ContentType): MediaQualityMetadata | null

    /**
     * The currently buffering media quality for the given content stream.
     * This is set immediately before a segment of a new quality is appended.
     *
     * Listen to {@link TrackEventMap.bufferingQualityChange} events for changes.
     * @param contentType 'video' | 'audio' | 'text'
     */
    getBufferingQuality(contentType: ContentType): MediaQualityMetadata | null

    /**
     * When this track is active, provides the currently playing media metadata
     * for the given content type.
     *
     * Listen to {@link TrackEventMap.playbackQualityChange} events for changes.
     * @param contentType 'video' | 'audio' | 'text'
     */
    getPlaybackQuality(contentType: ContentType): MediaQualityMetadata | null
}

export interface StreamingState extends ReadonlyStreamingState {
    /**
     * Clears any buffered or prefetched data, if applicable.
     */
    clearPrefetch(): void

    /**
     * Resets the track to recover from error states.
     * This will reset failed segments and clear error conditions to allow streaming to resume.
     */
    reset(): void
}

export interface ReadonlyTrack extends ReadonlyStreamingState, LogTarget {
    /**
     * The track identifier.
     */
    readonly uri: TrackUri

    /**
     * The type of track.
     */
    readonly type: TrackTypeId

    /**
     * True if the track is the currently playing track.
     */
    readonly active: boolean

    /**
     * True if the track has been disposed.
     */
    readonly disposed: boolean

    /**
     * Returns the `extra` object from the load configuration's `config` when
     * this track is active, or null if this track is not active.
     */
    readonly extra: any

    /**
     * The last error that occurred in this track, or null if no error.
     */
    readonly error: Error | null

    /**
     * Controller for sidecar text tracks discovered for this track, or null
     * if the track type does not surface text tracks.
     */
    readonly textTrackController: ReadonlyTextTrackController | null

    /**
     * Controller for ad breaks (e.g. HLS Interstitials) discovered for this
     * track, or null if the track type does not surface ads.
     */
    readonly adController: ReadonlyAdController | null
}

/**
 * One track is active on the track controller at a time.
 */
export interface Track<LoadOptionsType extends AnyRecord = AnyRecord>
    extends ReadonlyTrack, StreamingState, Disposable {
    /**
     * Mutable view of {@link ReadonlyTrack.textTrackController} that allows
     * selecting the active text track.
     */
    readonly textTrackController: TextTrackController | null

    /**
     * Mutable view of {@link ReadonlyTrack.adController} that allows feeding
     * playhead updates and replacing the discovered ad breaks.
     */
    readonly adController: AdController | null
    /**
     * Provides configuration to the track and begins preloading (if applicable).
     *
     * @param trackOptions Configuration provided by the TrackController.
     * @param loadOptions Configuration from `TrackLoadOptions.config`, provided by the Application.
     */
    preload(
        trackOptions: TrackPreloadOptions,
        loadOptions: LoadOptionsType
    ): void

    /**
     * Sets this track as active, deactivating any currently active track.
     * This should set sources on the playback source and add any listeners needed for shared
     * resources.
     *
     * @param loadOptions Configuration from `TrackLoadOptions.config`, provided by the Application.
     */
    activate(loadOptions: LoadOptionsType): void

    /**
     * Sets this track as inactive.
     * This should unset sources, and remove any listeners. Tracks do not implement disposable,
     * when they are deactivated they are expected to be free for garbage collection if there
     * are no longer references to the track.
     */
    deactivate(): void
}
