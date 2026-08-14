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
import type { MediaTimeline } from '../../streaming/MediaTimeline'
import {
    getMediaPeriodAtTime,
    type MediaPeriod,
} from '../../streaming/MediaTimeline'
import type { TextTrackController } from '../../text/TextTrack'
import type { TrackConfigOptions } from '../TrackFactory'

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

        // Set ad breaks to null to indicate they are loading TODO: clean this up
        this.setAdBreaks(null)
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
                this.deps.drmController.initializeForPlayback(
                    event.current,
                    this.disposeAbort
                )
            }
        })

        this.on('bufferingQualityChange', (event) => {
            this.deps.drmController.setBufferingDrmInfo(
                event.current,
                this.disposeAbort
            )
        })

        // Listen for timeline changes to update qualities seek ranges and ads.
        add(
            deps.mediaTimelineTransformed.onData(() => {
                this._cachedPeriod = null
                this.updateQualities()
                this.updateAdBreaks()
                this.updateSeekRanges()
            })
        )
        add(
            deps.mediaTimeline.onData(() => {
                this._cachedPeriod = null
                this.updateQualitiesUnfiltered()
            })
        )
    }

    /**
     * Updates the cached qualities list from the transformed timeline for the current period.
     */
    private updateQualities(): void {
        this.withTimeline((timeline) => {
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

    private updateAdBreaks() {
        this.withTimeline((timeline, interrupted) => {
            timeline
                .getAdBreaks()
                .then((adBreaks) => {
                    if (interrupted()) return
                    this.setAdBreaks(adBreaks)
                })
                .catch(this.errorHandler)
        })
    }

    /**
     * Updates the cached unfiltered qualities list from the raw timeline for the current period.
     */
    private updateQualitiesUnfiltered(): void {
        this.withTimeline((timeline) => {
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
        this.withTimeline((timeline, interrupted) => {
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
        })
    }

    /**
     * Invokes a callback when the media timeline promise resolves and was not
     * interrupted by a timeline change or track disposal.
     *
     * @param callback The function to call when the media timeline resolves.
     * This will not be invoked if the
     */
    private withTimeline(
        callback: (timeline: MediaTimeline, interrupted: () => boolean) => void
    ) {
        const mediaTimelinePromise = this.deps.mediaTimeline.value
        const interrupted = () =>
            this.disposed ||
            mediaTimelinePromise !== this.deps.mediaTimeline.value
        this.deps.mediaTimelineTransformed.value
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
        stream.on('bufferingEnded', () => {
            if (this.bufferingEnded) {
                this.deps.mediaSourceController.endOfStream()
                this.dispatch('bufferingEnded', {})
            }
        })
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
        loadOptions: TrackConfigOptions
    ) {
        const options: ContentStreamPreloadOptions = {
            startTime: loadOptions.startTime,
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

    onActivated(loadOptions: TrackConfigOptions): void {
        // A disposed track's deps throw DisposedError on access; never touch them.
        if (this.disposed) return
        // Rebuild the DOM text track. The element's added TextTracks are
        // dropped when the source is reset on deactivation (e.g. suspended for
        // an ad), so the active selection must be re-rendered on reactivation.
        this.deps.textTrackController?.resume()
        // AirPlay not supported using managed media sources
        this.deps.playbackSource.disableRemotePlayback = true

        this.streams.forEach((stream) => {
            this.deps.drmController.initializeForPlayback(
                stream.streamingQuality,
                this.disposeAbort
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
        // Tear down the DOM text track so its cues stop showing while this
        // track is suspended (e.g. an ad playing over it). The selection is
        // retained and re-rendered on reactivation via resume().
        this.deps.textTrackController?.suspend()

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
        this.clearStreams()
        super.dispose()
    }
}
