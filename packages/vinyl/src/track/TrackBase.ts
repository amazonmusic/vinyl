/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createAbortSlot,
    createDisposer,
    emptyRanges,
    equalDeep,
    EventHostImpl,
    isSilentError,
    logDebug,
    noop,
    type ReadonlyRanges,
    type ReadonlySet,
} from '@amazon/vinyl-util'
import type { PlaybackController } from '../playback/PlaybackController'
import type {
    Track,
    TrackEventMap,
    TrackPreloadOptions,
    TrackTypeId,
    TrackUri,
} from './Track'
import type { SeekRange } from './SeekRange'
import { type DrmController } from '../drm/DrmController'
import type {
    ContentType,
    MediaQualityMetadata,
} from '../streaming/MediaQualityMetadata'
import type { TextTrackController } from '../text/TextTrack'
import type { AdBreakList, TrackAds } from '../ad/AdBreakInfo'
import type { TrackConfigOptions } from './TrackFactory'

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
 * A base class for all tracks.
 */
export abstract class TrackBase<
    EventMap extends TrackEventMap = TrackEventMap,
    ConfigType extends TrackConfigOptions = TrackConfigOptions,
>
    extends EventHostImpl<EventMap>
    implements Track<ConfigType>
{
    get [Symbol.toStringTag](): string {
        return 'TrackBase'
    }

    /**
     * The current load options, if this is an active track.
     */
    protected loadOptions: ConfigType | null = null

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

    /**
     * Default text track controller is null. Tracks that surface text tracks
     * (e.g. {@link MseTrack}) override this getter.
     */
    get textTrackController(): TextTrackController | null {
        return null
    }

    /**
     * The presentation seek range of the media.
     * Most often {start=0, end=duration} but may be different depending on the
     * media timeline.
     */
    get seekRange(): SeekRange | null {
        return this._seekRange
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
    private _trackAds: TrackAds | null = null
    private _seekRange: SeekRange | null = null

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
        // Default to no ads, implementations can set this to null to indicate
        // that ads are loading.
        this.setAdBreaks([])
    }

    toString(): string {
        return `[${this[Symbol.toStringTag]}#${this.uri}]`
    }

    get error(): Error | null {
        return this._error
    }

    preload(
        _trackOptions: TrackPreloadOptions,
        _loadOptions: ConfigType
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

    activate(loadOptions: ConfigType): void {
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
    abstract onActivated(loadOptions: ConfigType): void

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

    abstract clearPrefetch(): void

    protected closeDrmSessions() {
        this.drmSessionAbort.abort()
    }

    get ads() {
        return this._trackAds
    }

    /**
     * Sets the ad breaks for this track, emitting an `adsChange` event.
     * `TrackController` will update the ad manager and manage the ad tracks.
     * For tracks with no ads this is expected to be called with an empty array.
     *
     * @param value
     * @protected
     */
    protected setAdBreaks(value: AdBreakList | null) {
        const previous = this._trackAds
        if (equalDeep(previous?.adBreaks ?? null, value)) return // no-op
        this._trackAds =
            value == null
                ? null
                : {
                      trackUri: this.uri,
                      adBreaks: value,
                  }
        this.dispatch('adsChange', {
            previous,
            current: this._trackAds,
        })
    }

    protected setSeekRange(value: SeekRange): void {
        const prev = this._seekRange
        if (equalDeep(prev, value)) return
        const previous = this._seekRange
        this._seekRange = value
        logDebug(this, `seekRangeChange start=${value.start}, end=${value.end}`)
        this.dispatch('seekRangeChange', {
            previous,
            current: value,
        })
    }

    /**
     * Resets the track to recover from error states.
     * Base implementation does nothing.
     *
     * Overrides should dispatch 'reset' after resetting error state.
     */
    reset(hard = false): void {
        if (!hard && !this._error) {
            logDebug(this, 'reset no-op')
            return
        }
        if (hard) {
            // On a hard reset, deactivate/activate the track,
            // restore playback seek and playing state.
            const loadOptions = this.loadOptions
            if (loadOptions) {
                const { playbackController } = this.deps
                const wasPaused =
                    playbackController.paused || playbackController.ended
                const time = playbackController.currentTime
                this.onDeactivated()
                // Clear the prefetch on a hard reset, in the case of codecs unsupported, the prefetch would
                // otherwise contain unsupported segments.
                this.clearPrefetch()
                this.onActivated(loadOptions)
                playbackController.seekTo(time).catch(noop)
                if (!wasPaused) playbackController.play().catch(noop)
            }
        }
        logDebug(this, 'reset, hard:', hard)
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
