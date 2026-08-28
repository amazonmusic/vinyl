/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { TrackBase, type TrackBaseDeps } from '../TrackBase'
import {
    Abort,
    equalDeep,
    first,
    type Fun,
    IntersectionRanges,
    logDebug,
    type Maybe,
    noop,
    type ReadonlyRanges,
    type ReadonlySet,
    redispatchEvents,
    type Unsubscribe,
} from '@amazon/vinyl-util'
import type { TrackPreloadOptions, TrackTypeId, TrackUri } from '../Track'
import type {
    ContentType,
    MediaQualityMetadata,
} from '../../streaming/MediaQualityMetadata'
import { createContainer, type Factories } from '@amazon/vinyl-di'
import type {
    ContentStream,
    ContentStreamPreloadOptions,
} from '../../streaming/ContentStream'
import type { MediaSourceController } from '../../streaming/buffering/MediaSourceController'
import type { PlaybackSource } from '../../playback/PlaybackSource'
import type { ContentTypesValue } from '../../streaming/ContentTypesValue'
import type { ManifestController } from '../../streaming/ManifestController'
import type { ObservableValue } from '@amazon/vinyl-observable'
import {
    getMediaPeriodAtTime,
    type MediaPeriod,
    type MediaTimeline,
} from '../../streaming/MediaTimeline'
import type { TextTrackController } from '../../text/TextTrack'
import type { TrackConfigOptions } from '../TrackFactory'
import type { LoadSpanMeasurement } from '../../streaming/LoadMetric'
import type { TrackAds } from '../../ad/AdBreakInfo'
import type { VinylOptions } from '../../vinyl/VinylOptions'

/**
 * How long to wait after all streams have data before checking whether a seek
 * is still stuck, in seconds.
 */
export const SEEKING_STALL_TIME_CHECK = 0.1

/**
 * How far to nudge the playhead, in seconds, to recover a stuck seek.
 */
export const PLAYHEAD_NUDGE = 0.05

export type MseTrackDeps = TrackBaseDeps & {
    readonly contentTypesValue: ContentTypesValue
    readonly contentStreamFactory: (contentType: ContentType) => ContentStream
    readonly manifestController: ManifestController<unknown>
    readonly mediaSourceController: MediaSourceController
    readonly playbackSource: PlaybackSource
    readonly mediaTimeline: ObservableValue<Promise<MediaTimeline>>
    readonly mediaTimelineTransformed: ObservableValue<Promise<MediaTimeline>>
    /**
     * Optional sidecar text track controller for this track. When provided,
     * the controller is exposed via {@link MseTrack.textTrackController} and
     * disposed when the track itself is disposed.
     */
    readonly textTrackController?: TextTrackController | null

    /**
     * Player options that re-select this track's audio/streams. A change (not
     * the initial value) is applied to this track immediately so it takes
     * effect without waiting for the buffered media to drain.
     */
    readonly audio: ObservableValue<VinylOptions['audio']>
    readonly allowedContentTypes: ObservableValue<
        VinylOptions['allowedContentTypes']
    >
    readonly abr: ObservableValue<VinylOptions['abr']>
}

type FunctionKeys<T> = {
    [P in keyof T]: T[P] extends Fun ? P : never
}[keyof T]

/**
 * An MseTrack uses media source extensions for streaming.
 */
export class MseTrack extends TrackBase {
    get [Symbol.toStringTag](): string {
        return 'MseTrack'
    }

    declare protected readonly deps: MseTrackDeps

    override get textTrackController(): TextTrackController | null {
        // Reading a dep on a disposed track throws DisposedError (its DI
        // container's lazies are disposed); a stale reference has no controller.
        if (this.disposed) return null
        return this.deps.textTrackController ?? null
    }

    private readonly streams: ContentStream[] = []
    private stallNudgeTimer: ReturnType<typeof setTimeout> | null = null
    private readonly disposeAbort = new Abort()
    private lastPreloadOptions: ContentStreamPreloadOptions | null = null
    private readonly allFetchedRanges: ReadonlyRanges[] = []
    private readonly _fetchedRanges = new IntersectionRanges(
        this.allFetchedRanges,
        { useCache: true }
    )
    private _contentTypes: ReadonlySet<ContentType> = new Set()

    private _qualities: readonly MediaQualityMetadata[] | null = null
    private _qualitiesUnfiltered: readonly MediaQualityMetadata[] | null = null
    private timeUpdateSub: Unsubscribe | null = null
    private _cachedPeriod: MediaPeriod | null = null

    constructor(
        uri: TrackUri,
        type: TrackTypeId,
        dependencyFactories: Factories<MseTrackDeps>
    ) {
        const depsContainer = createContainer(dependencyFactories)
        const deps = depsContainer.dependencies
        super(uri, type, deps)
        logDebug(this, 'constructed')
        const { add } = this.disposer
        add(depsContainer)
        this.deps = deps

        add(
            deps.contentTypesValue.onData((contentTypesPromise) => {
                contentTypesPromise
                    .then((value) => this.setContentTypes(value))
                    .catch(this.errorHandler)
            })
        )

        // DRM
        this.on('streamingQualityChange', (event) => {
            if (this.active) {
                this.deps.drmController.initializeForPlayback(event.current, {
                    trackUri: this.uri,
                    abort: this.disposeAbort,
                })
            }
        })

        this.on('bufferingQualityChange', (event) => {
            // Keep the DRM info while a stream's buffering transiently clears
            // (a seek or reaching the end): with multiple encrypted streams, an
            // `encrypted` event from another stream still (re)appending its init
            // segment needs it. The info is cleared on deactivation instead.
            if (event.current == null) return
            this.deps.drmController.setBufferingDrmInfo(event.current, {
                trackUri: this.uri,
                abort: this.disposeAbort,
            })
        })

        // Listen for timeline changes to update qualities seek ranges and ads.
        add(
            deps.mediaTimelineTransformed.onData(() => {
                this._cachedPeriod = null
                this.updateQualities()
                this.updateSeekRanges()
                this.dispatch('adsChange', {})
            })
        )
        add(
            deps.mediaTimeline.onData(() => {
                this._cachedPeriod = null
                this.updateQualitiesUnfiltered()
            })
        )

        // Surface the manifest fetch span alongside the streams' segment spans,
        // attributing it to this track at the source.
        add(
            deps.manifestController.on('loadSpanMeasured', (measurement) =>
                this.dispatchLoadSpan(measurement)
            )
        )

        // Audio/stream selection options: a change (never the initial value)
        // re-filters the timeline, so rebuild this track's streams in place.
        add(
            deps.audio.onData((_value, previous) => {
                if (previous !== undefined) this.reloadStreams()
            })
        )
        add(
            deps.allowedContentTypes.onData((_value, previous) => {
                if (previous !== undefined) this.reloadStreams()
            })
        )
        // A resolution-restriction change re-selects a quality from the same
        // streams, so clearing the buffer is enough — no rebuild is needed.
        add(
            deps.abr.onData((value, previous) => {
                if (previous === undefined) return
                if (
                    value.maxHeight !== previous.maxHeight ||
                    value.maxWidth !== previous.maxWidth
                ) {
                    this.clearPrefetch()
                }
            })
        )
    }

    /**
     * Clears this track's buffers and rebuilds its streams so a changed
     * audio/language/content-type selection applies immediately.
     * {@link reset} with `hard` safely no-ops the rebuild for an inactive
     * (cached) track.
     */
    private reloadStreams(): void {
        this.clearPrefetch()
        this.reset(/* hard */ true)
    }

    /**
     * Re-dispatches a sub-controller's load span stamped with this track's uri,
     * so the span attributes to the track that owns it at the source.
     */
    private dispatchLoadSpan(measurement: LoadSpanMeasurement): void {
        this.dispatch('loadSpanMeasured', {
            ...measurement,
            trackUri: this.uri,
        })
    }

    /**
     * Updates the cached qualities list from the transformed timeline for the current period.
     */
    private updateQualities(): void {
        this.withTimeline(this.deps.mediaTimelineTransformed, (timeline) => {
            const time = this.deps.playbackController.currentTime
            const period = getMediaPeriodAtTime(timeline, time)
            this._cachedPeriod = period
            const newQualities = period
                ? period.qualities.map((q) => q.metadata)
                : null
            if (!equalDeep(newQualities, this._qualities)) {
                const previous = this._qualities
                this._qualities = newQualities
                if (newQualities) {
                    this.dispatch('qualitiesChange', {
                        previous: previous ?? [],
                        current: newQualities,
                    })
                }
            }
        })
    }

    async getAds(): Promise<TrackAds> {
        const timeline = await this.deps.mediaTimeline.value
        return {
            trackUri: this.uri,
            adBreaks: await timeline.getAdBreaks(),
        }
    }

    /**
     * Updates the cached unfiltered qualities list from the raw timeline for the current period.
     */
    private updateQualitiesUnfiltered(): void {
        this.withTimeline(this.deps.mediaTimeline, (timeline) => {
            const time = this.deps.playbackController.currentTime
            const period = getMediaPeriodAtTime(timeline, time)
            const newQualities = period
                ? period.qualities.map((q) => q.metadata)
                : null
            if (!equalDeep(newQualities, this._qualitiesUnfiltered)) {
                const previous = this._qualitiesUnfiltered
                this._qualitiesUnfiltered = newQualities
                if (newQualities) {
                    this.dispatch('qualitiesUnfilteredChange', {
                        previous: previous ?? [],
                        current: newQualities,
                    })
                }
            }
        })
    }

    private updateSeekRanges(): void {
        this.withTimeline(
            this.deps.mediaTimelineTransformed,
            (timeline, interrupted) => {
                timeline
                    .getDuration()
                    .then((duration) => {
                        if (interrupted()) return
                        const start = first(timeline.periods)?.startTime ?? 0
                        this.setSeekRange({
                            start,
                            end: start + duration,
                        })
                    })
                    .catch(this.errorHandler)
            }
        )
    }

    /**
     * Invokes a callback when the given timeline promise resolves and was not
     * interrupted by that timeline changing or the track being disposed.
     *
     * Pass `mediaTimelineTransformed` for the playable (filtered) view or
     * `mediaTimeline` for the raw, unfiltered view.
     */
    private withTimeline(
        timelineSource: ObservableValue<Promise<MediaTimeline>>,
        callback: (timeline: MediaTimeline, interrupted: () => boolean) => void
    ) {
        const timelinePromise = timelineSource.value
        const interrupted = () =>
            this.disposed || timelinePromise !== timelineSource.value
        timelinePromise
            .then((timeline) => {
                if (!interrupted()) callback(timeline, interrupted)
            })
            .catch(this.errorHandler)
    }

    /**
     * Creates and adds a content stream for the given content type.
     *
     * @param contentType
     */
    protected createStream(contentType: ContentType): void {
        const stream = this.deps.contentStreamFactory(contentType)
        redispatchEvents(this, stream, [
            'fetchedRangesChange',
            'streamingQualityChange',
            'bufferingQualityChange',
            'playbackQualityChange',
            'codecUnsupported',
        ])
        // Stamp the segment spans with this track's uri at the source rather
        // than blindly redispatching the unattributed measurement.
        stream.on('loadSpanMeasured', (measurement) =>
            this.dispatchLoadSpan(measurement)
        )
        stream.on('bufferingEnded', () => {
            if (this.bufferingEnded) {
                this.deps.mediaSourceController.endOfStream()
                this.dispatch('bufferingEnded', {})
            }
        })
        stream.on('hasDataChange', () => this.checkStalledSeek())
        stream.on('fetchedRangesChange', () => {
            this._fetchedRanges.invalidate()
        })
        stream.on('error', (event) => {
            if (!this._error) {
                // Set error state and bubble event
                this._error = event.error
                this.dispatch('error', event)
            }
        })

        // The fetched ranges of the track is the intersection of all content stream fetched ranges.
        this.allFetchedRanges.push(stream.fetchedRanges)
        this._fetchedRanges.invalidate()

        this.streams.push(stream)
        if (this.lastPreloadOptions) {
            stream.preload(this.lastPreloadOptions)
        }
        if (this.loadOptions) {
            stream.activate(this.loadOptions)
        }
    }

    preload(
        trackOptions: TrackPreloadOptions,
        loadOptions: Maybe<TrackConfigOptions>
    ) {
        const options: ContentStreamPreloadOptions = {
            startTime: loadOptions?.startTime,
            prefetchPriority: trackOptions.prefetchPriority,
        }
        this.lastPreloadOptions = options
        this.callOnStreams('preload', options)
    }

    get contentTypes(): ReadonlySet<ContentType> {
        return this._contentTypes
    }

    get qualities(): readonly MediaQualityMetadata[] | null {
        return this._qualities
    }

    get qualitiesUnfiltered(): readonly MediaQualityMetadata[] | null {
        return this._qualitiesUnfiltered
    }

    get fetchedRanges(): ReadonlyRanges {
        return this._fetchedRanges
    }

    /**
     * Clears all fetched fragments and source buffers. Streaming will resume.
     * This should be called if a change has been made where the user would expect an immediate change,
     * for example, changing streaming quality from SD to HD.
     */
    clearPrefetch() {
        logDebug(this, 'clearPrefetch')
        this.callOnStreams('clearPrefetch')
    }

    /**
     * Resets the track to recover from error states.
     * Resets both the segment controller and buffering controller to clear failed segments and error conditions.
     */
    reset(hard = false): void {
        if (!hard && !this.error) {
            logDebug(this, 'reset no-op')
            return
        }
        super.reset(hard)
        this.deps.manifestController.reset()
        this.callOnStreams('reset')
    }

    onActivated(loadOptions: Maybe<TrackConfigOptions>): void {
        // A disposed track's deps throw DisposedError on access; never touch them.
        if (this.disposed) return
        // Rebuild the DOM text track. The element's added TextTracks are
        // dropped when the source is reset on deactivation (e.g. suspended for
        // an ad), so the active selection must be re-rendered on reactivation.
        this.deps.textTrackController?.activate()
        // AirPlay not supported using managed media sources
        this.deps.playbackSource.disableRemotePlayback = true

        this.streams.forEach((stream) => {
            this.deps.drmController.initializeForPlayback(
                stream.streamingQuality,
                { trackUri: this.uri, abort: this.disposeAbort }
            )
        })
        this.deps.playbackSource.src =
            this.deps.mediaSourceController.activate()
        this.callOnStreams('activate', loadOptions)

        // Listen for timeUpdate to detect period changes.
        this.timeUpdateSub = this.deps.playbackController.on(
            'timeUpdate',
            () => {
                const time = this.deps.playbackController.currentTime
                const cached = this._cachedPeriod
                if (
                    cached &&
                    time >= cached.startTime &&
                    time < cached.endTime
                ) {
                    // The period hasn't changed
                    return
                }
                this.updateQualities()
                this.updateQualitiesUnfiltered()
            }
        )
    }

    onDeactivated(): void {
        // A disposed track's deps throw DisposedError on access; never touch them.
        if (this.disposed) return
        this.timeUpdateSub?.()
        this.timeUpdateSub = null
        this.callOnStreams('deactivate')
        // Streams' transient buffering clears no longer clear the DRM info, so
        // clear it here now that the track is no longer buffering.
        this.deps.drmController.setBufferingDrmInfo(null, {
            trackUri: this.uri,
            abort: this.disposeAbort,
        })
        // Tear down the DOM text track so its cues stop showing while this
        // track is suspended (e.g. an ad playing over it). The selection is
        // retained and re-rendered on reactivation via resume().
        this.deps.textTrackController?.deactivate()

        this.deps.playbackSource.src = null
        this.deps.playbackSource.load()
        this.deps.mediaSourceController.deactivate()
    }

    getStreamingQuality(contentType: ContentType): MediaQualityMetadata | null {
        return this.getStream(contentType)?.streamingQuality ?? null
    }

    getBufferingQuality(contentType: ContentType): MediaQualityMetadata | null {
        return this.getStream(contentType)?.bufferingQuality ?? null
    }

    getPlaybackQuality(contentType: ContentType): MediaQualityMetadata | null {
        return this.getStream(contentType)?.playbackQuality ?? null
    }

    /**
     * Calls the specified method on all streams with the provided arguments.
     */
    private callOnStreams<K extends FunctionKeys<ContentStream>>(
        functionName: K,
        ...args: Parameters<ContentStream[K]>
    ) {
        this.streams.forEach((stream) => {
            ;(stream[functionName] as Fun)(...args)
        })
    }

    private getStream(contentType: ContentType): ContentStream | undefined {
        return this.streams.find((s) => s.contentType === contentType)
    }

    private clearStreams() {
        this.callOnStreams('dispose')
        this.streams.length = 0
        this.allFetchedRanges.length = 0
        this._fetchedRanges.invalidate()
    }

    get bufferingEnded(): boolean {
        return this.streams.every((stream) => stream.bufferingEnded)
    }

    /**
     * A seek only completes once every stream has data at the target, but on
     * some platforms the element can stay stuck `seeking` even after that. Once
     * all streams hold data, if we're still seeking a moment later, nudge the
     * playhead to prod the element into completing the seek.
     */
    private checkStalledSeek(): void {
        const { playbackController } = this.deps
        if (this.stallNudgeTimer !== null || !playbackController.seeking) return
        if (!this.streams.length || !this.streams.every((s) => s.hasData)) {
            return
        }
        this.stallNudgeTimer = setTimeout(() => {
            this.stallNudgeTimer = null
            if (this.disposed || !playbackController.seeking) return
            if (!this.streams.every((s) => s.hasData)) return
            const from = playbackController.currentTime
            const to = from + PLAYHEAD_NUDGE
            // An internal recovery seek, not a user seek — logged so the two
            // are distinguishable in playback traces.
            logDebug(
                this,
                'nudging playhead to recover a stalled seek',
                from,
                '->',
                to
            )
            playbackController.seekTo(to, 0).catch(noop)
        }, SEEKING_STALL_TIME_CHECK * 1000)
    }

    private setContentTypes(contentTypes: ReadonlySet<ContentType>) {
        if (this.disposed) return
        const previous = this.contentTypes
        if (equalDeep(previous, contentTypes)) return // no-op
        logDebug(this, 'content types:', contentTypes)
        if (previous.size) {
            // Content types were previously set, hard reset this track
            // so the media source is recreated
            this.reset(/* hard */ true)
        }
        this.clearStreams()
        for (const contentType of contentTypes) {
            this.createStream(contentType)
        }
        // Sets the content types and dispatches a change event:
        this._contentTypes = contentTypes
        this.dispatch('contentTypesChange', {
            previous,
            current: contentTypes,
        })
    }

    dispose(): void {
        logDebug(this, 'dispose')
        if (this.stallNudgeTimer !== null) clearTimeout(this.stallNudgeTimer)
        this.clearStreams()
        super.dispose()
    }
}
