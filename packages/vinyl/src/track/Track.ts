/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    Covariant,
    Disposable,
    EventHandler,
    LogTarget,
    Maybe,
    ReadonlyEventHost,
    ReadonlyRanges,
    ReadonlySet,
    SignalOptions,
    Unsubscribe,
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
import type { SeekRange } from './SeekRange'
import type { ChangeEvent } from '../event/ChangeEvent'
import type { TrackAds } from '../ad/AdBreakInfo'
import type { TrackConfigOptions } from './TrackFactory'

export type { SeekRange } from './SeekRange'

/**
 * All events a track may emit.
 * Streaming-related events are separated as they will be bubbled by the player.
 */
export type TrackEventMap = StreamingEventMap & {
    readonly adsChange: ChangeEvent<TrackAds | null>
}

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
     *
     * @param hard If true, the track will reset the playback state and
     * recreate media sources.
     */
    reset(hard?: boolean): void
}

export interface ReadonlyTrack
    extends
        ReadonlyEventHost<TrackEventMap>,
        ReadonlyStreamingState,
        LogTarget {
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
     * The seekable range on the media timeline, or null when not yet known
     * (e.g. before the manifest is loaded). Based on the media timeline, not
     * the element's native seekable ranges.
     */
    readonly seekRange: SeekRange | null

    /**
     * The ads for this track.
     * A null value indicates the track ads are loading.
     *
     * @see {@link TrackEventMap} — the `adsChange` event.
     */
    readonly ads: TrackAds | null

    readonly __eventMapType: Covariant<TrackEventMap>
    hasListeners(type: keyof TrackEventMap): boolean
    on<K extends keyof TrackEventMap>(
        type: K,
        handler: EventHandler<TrackEventMap[K]>,
        options?: SignalOptions
    ): Unsubscribe
}

/**
 * One track is active on the track controller at a time.
 */
export interface Track<
    ConfigType extends TrackConfigOptions = TrackConfigOptions,
>
    extends ReadonlyTrack, StreamingState, Disposable {
    /**
     * Mutable view of {@link ReadonlyTrack.textTrackController} that allows
     * selecting the active text track.
     */
    readonly textTrackController: TextTrackController | null

    /**
     * Provides configuration to the track and begins preloading (if applicable).
     *
     * @param trackOptions Configuration provided by the TrackController.
     * @param loadOptions Configuration from `TrackLoadOptions.config`, provided by the Application.
     */
    preload(
        trackOptions: TrackPreloadOptions,
        loadOptions: Maybe<ConfigType>
    ): void

    /**
     * Sets this track as active, deactivating any currently active track.
     * This should set sources on the playback source and add any listeners needed for shared
     * resources.
     *
     * @param loadOptions Configuration from `TrackLoadOptions.config`, provided by the Application.
     */
    activate(loadOptions: Maybe<ConfigType>): void

    /**
     * Sets this track as inactive.
     * This should unset sources, and remove any listeners. Tracks do not implement disposable,
     * when they are deactivated they are expected to be free for garbage collection if there
     * are no longer references to the track.
     */
    deactivate(): void

    /**
     * True if this track is disposed.
     */
    readonly disposed: boolean

    readonly __eventMapType: Covariant<TrackEventMap>
    hasListeners(type: keyof TrackEventMap): boolean
    on<K extends keyof TrackEventMap>(
        type: K,
        handler: EventHandler<TrackEventMap[K]>,
        options?: SignalOptions
    ): Unsubscribe
}
