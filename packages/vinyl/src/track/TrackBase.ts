/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ObjectSchema } from '@amazon/vinyl-validation'
import { any, number, object } from '@amazon/vinyl-validation'
import {
    createAbortSlot,
    createDisposer,
    emptyRanges,
    EventHostImpl,
    isSilentError,
    logDebug,
    type Maybe,
    noop,
    type ReadonlyRanges,
    type ReadonlySet,
} from '@amazon/vinyl-util'
import type { PlaybackController } from '@/playback/PlaybackController'
import type {
    Track,
    TrackEventMap,
    TrackPreloadOptions,
    TrackTypeId,
    TrackUri,
} from './Track'
import { type DrmController } from '@/drm/DrmController'
import type {
    ContentType,
    MediaQualityMetadata,
} from '@/streaming/MediaQualityMetadata'
import { type DrmOptions, drmOptionsValidator } from '@/drm/DrmOptions'

/**
 * Dependencies for TrackBase.
 */
export interface TrackBaseDeps {
    /**
     * When the track is activated, playback will seek to the track's start time.
     */
    readonly playbackController: PlaybackController

    /**
     * DrmController manages track encryption.
     */
    readonly drmController: DrmController
}

/**
 * General configuration for tracks set in track load options.
 */
export interface TrackBaseOptions {
    /**
     * The time to seek to when the track has been activated.
     * For MSE tracks this will affect pre-fetching.
     */
    readonly startTime?: Maybe<number>

    /**
     * Extra application data to associate with the track.
     */
    readonly extra?: any

    /**
     * DRM Configuration overrides for this track.
     */
    readonly drm?: Partial<DrmOptions>
}

export const trackBaseOptionsValidator: ObjectSchema<TrackBaseOptions> = object(
    {
        extra: any().optional(),
        startTime: number().maybe().optional(),
        drm: drmOptionsValidator.partial().optional(),
    }
)

/**
 * A base class for all tracks.
 */
export abstract class TrackBase<
        EventMap extends TrackEventMap = TrackEventMap,
        LoadOptionsType extends TrackBaseOptions = TrackBaseOptions,
    >
    extends EventHostImpl<EventMap>
    implements Track<LoadOptionsType>
{
    get [Symbol.toStringTag](): string {
        return 'TrackBase'
    }

    /**
     * The current load options, if this is an active track.
     */
    protected loadOptions: LoadOptionsType | null = null

    protected readonly errorHandler = (error: any): void => {
        if (this._error) return // Already in an error state
        if (!isSilentError(error)) {
            this._error = error
            this.dispatch('error', {
                target: this,
                error,
            })
        }
    }
    protected readonly disposer = createDisposer()
    protected drmSessionAbort = createAbortSlot()

    get fetchedRanges(): ReadonlyRanges {
        return emptyRanges
    }

    abstract get contentTypes(): ReadonlySet<ContentType>

    abstract get qualities(): readonly MediaQualityMetadata[] | null
    abstract get qualitiesUnfiltered(): readonly MediaQualityMetadata[] | null

    abstract getStreamingQuality(
        contentType: ContentType
    ): MediaQualityMetadata | null
    abstract getBufferingQuality(
        contentType: ContentType
    ): MediaQualityMetadata | null
    abstract getPlaybackQuality(
        contentType: ContentType
    ): MediaQualityMetadata | null

    /**
     * Sets on handleError, cleared on 'reset'.
     */
    protected _error: Error | null = null

    private _active = false

    protected constructor(
        /**
         * The identifier of this track, used as the key in the track cache.
         */
        readonly uri: TrackUri,

        /**
         * The track type.
         */
        readonly type: TrackTypeId,

        protected readonly deps: TrackBaseDeps
    ) {
        super()
    }

    get error(): Error | null {
        return this._error
    }

    preload(
        _trackOptions: TrackPreloadOptions,
        _loadOptions: LoadOptionsType
    ): void {}

    get extra(): any {
        return this.loadOptions?.extra ?? null
    }

    get active(): boolean {
        return this._active
    }

    get disposed(): boolean {
        return this.disposer.disposed
    }

    activate(loadOptions: LoadOptionsType): void {
        if (this._active) return
        this.loadOptions = loadOptions
        this.reset() // Reset error state on activate
        this._active = true
        logDebug(this, 'activate', this.uri)
        this.deps.playbackController
            .seekTo(loadOptions.startTime ?? 0)
            .catch(noop)
        this.deps.drmController.configure(loadOptions.drm)
        this.onActivated(loadOptions)
    }

    /**
     * The track has been activated.
     * Operations on shared resources such as the playback controller may only be done while the
     * track is currently active. For example if there is a loading operation before the
     * playback source is set, isActive must be checked before the property is changed.
     */
    abstract onActivated(loadOptions: LoadOptionsType): void

    deactivate(): void {
        if (!this._active) return
        this._active = false
        this.loadOptions = null
        logDebug(this, 'deactivate', this.uri)
        this.deps.playbackController.pause()
        this.onDeactivated()
        this.closeDrmSessions()
    }

    abstract onDeactivated(): void

    toString(): string {
        return `[${this[Symbol.toStringTag]}#${this.uri}]`
    }

    protected closeDrmSessions() {
        this.drmSessionAbort.abort()
    }

    abstract clearPrefetch(): void

    /**
     * Resets the track to recover from error states.
     * Base implementation does nothing.
     *
     * Overrides should dispatch 'reset' after resetting error state.
     */
    reset(): void {
        if (this._error == null) {
            logDebug(this, 'reset no-op')
            return
        }
        logDebug(this, 'reset')
        this._error = null
        this.dispatch('reset', {})
    }

    dispose() {
        if (this.active) this.deactivate()
        else this.closeDrmSessions() // closes sessions created from prefetch.
        this.disposer.dispose()
        super.dispose()
    }
}
