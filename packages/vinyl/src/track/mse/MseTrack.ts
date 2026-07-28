/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    TrackBase,
    type TrackBaseDeps,
    type TrackBaseOptions,
} from '../TrackBase'
import {
    Abort,
    equalDeep,
    type Fun,
    IntersectionRanges,
    logDebug,
    type ReadonlyRanges,
    type ReadonlySet,
    redispatchEvents,
    type Unsubscribe,
} from '@amazon/vinyl-util'
import type {
    Track,
    TrackPreloadOptions,
    TrackTypeId,
    TrackUri,
} from '../Track'
import type { SeekRange } from '../SeekRange'
import type {
    ContentType,
    MediaQualityMetadata,
} from '../../streaming/MediaQualityMetadata'
import { createContainer, type Factories } from '@amazon/vinyl-di'
import type {
    ContentStream,
    ContentStreamActivateOptions,
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
import type { AdBreakInfo, AdController } from '../../ad/AdBreak'
import type { ChangeEvent } from '../../event/ChangeEvent'

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
     * The player-level ad controller. MseTrack sets ad breaks on it when
     * the media timeline resolves and listens for ad break changes to
     * switch playback to/from ad tracks.
     */
    readonly adController?: AdController | null
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
        return this.deps.textTrackController ?? null
    }

    override get adController(): AdController | null {
        return this.deps.adController ?? null
    }

    override get seekRange(): SeekRange | null {
        return this._seekRange
    }

    get currentAdTrack(): Track | null {
        return this._currentAdTrack
    }

    private readonly streams: ContentStream[] = []
    private readonly disposeAbort = new Abort()
    private lastPreloadOptions: ContentStreamPreloadOptions | null = null
    private activateOptions: ContentStreamActivateOptions | null = null
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
    private _seekRange: SeekRange | null = null
    private readonly _preloadedAdIds = new Set<string>()
    private _currentAdTrack: Track | null = null
    private _adResumeTime: number = 0
    private _adErrorSub: Unsubscribe | null = null
    private _adEndedSub: Unsubscribe | null = null
    private _adTimeoutId: ReturnType<typeof setTimeout> | null = null
    private _activeAdIndex: number = 0

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

        if (deps.adController) {
            add(
                deps.adController.on('adBreaksChange', () => {
                    this._preloadedAdIds.clear()
                })
            )
            add(
                deps.adController.on(
                    'adBreakChange',
                    (event: ChangeEvent<AdBreakInfo | null>) => {
                        if (!this.active) return
                        if (event.current && event.current.ads.length > 0) {
                            this._activeAdIndex = 0
                            this.activateAdAtIndex(event.current, 0)
                        } else if (this._currentAdTrack) {
                            this.setCurrentAdTrack(null)
                        }
                    }
                )
            )
        }

        add(
            deps.contentTypesValue.onData((contentTypesPromise) => {
                contentTypesPromise
                    .then((contentTypes) => {
                        if (this.disposer.disposed) return
                        if (equalDeep(this.contentTypes, contentTypes)) return // no-op
                        logDebug(this, 'content types:', contentTypes)
                        this.clearStreams()
                        for (const contentType of contentTypes) {
                            this.createStream(contentType)
                        }
                        // Sets the content types and dispatches a change event:
                        this.contentTypes = contentTypes
                    })
                    .catch(this.errorHandler)
            })
        )

        // DRM
        this.on('streamingQualityChange', (event) => {
            if (this.activateOptions) {
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

        // Listen for timeline changes to update qualities.
        add(
            deps.mediaTimelineTransformed.onData(() => {
                this._cachedPeriod = null
                this.updateQualities()
            })
        )
        add(
            deps.mediaTimeline.onData((timelinePromise) => {
                this._cachedPeriod = null
                this.updateQualitiesUnfiltered()
                timelinePromise
                    .then((timeline) => {
                        if (this.disposer.disposed) return
                        if (timeline.adBreaks.length > 0) {
                            this.deps.adController?.setAdBreaks(
                                timeline.adBreaks
                            )
                        }
                        return timeline.getDuration().then((duration) => {
                            if (this.disposer.disposed) return
                            const start =
                                timeline.periods.length > 0
                                    ? timeline.periods[0].startTime
                                    : 0
                            const newRange: SeekRange = {
                                start,
                                end:
                                    duration === Infinity
                                        ? Infinity
                                        : start + duration,
                            }
                            const prev = this._seekRange
                            if (
                                prev == null ||
                                prev.start !== newRange.start ||
                                prev.end !== newRange.end
                            ) {
                                const previous = this._seekRange
                                this._seekRange = newRange
                                this.dispatch('seekRangeChange', {
                                    previous,
                                    current: newRange,
                                })
                            }
                        })
                    })
                    .catch(this.errorHandler)
            })
        )
    }

    /**
     * Updates the cached qualities list from the transformed timeline for the current period.
     */
    private updateQualities(): void {
        const time = this.deps.playbackController.currentTime
        this.deps.mediaTimelineTransformed.value
            .then((timeline) => {
                if (this.disposer.disposed) return
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
            .catch(this.errorHandler)
    }

    /**
     * Updates the cached unfiltered qualities list from the raw timeline for the current period.
     */
    private updateQualitiesUnfiltered(): void {
        const time = this.deps.playbackController.currentTime
        this.deps.mediaTimeline.value
            .then((timeline) => {
                if (this.disposer.disposed) return
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
        if (this.activateOptions) {
            stream.activate(this.activateOptions)
        }
    }

    preload(trackOptions: TrackPreloadOptions, loadOptions: TrackBaseOptions) {
        const options = {
            startTime: loadOptions.startTime,
            prefetchPriority: trackOptions.prefetchPriority,
        }
        this.lastPreloadOptions = options
        this.callOnStreams('preload', options)
    }

    get contentTypes(): ReadonlySet<ContentType> {
        return this._contentTypes
    }

    set contentTypes(value: ReadonlySet<ContentType>) {
        const previous = this._contentTypes
        this._contentTypes = value
        this.dispatch('contentTypesChange', {
            previous,
            current: value,
        })
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
    reset(): void {
        if (!this.error) {
            logDebug(this, 'reset no-op')
            return
        }
        this.deps.manifestController.reset()
        this.callOnStreams('reset')
        super.reset()
    }

    onActivated(loadOptions: TrackBaseOptions): void {
        this.activateOptions = loadOptions
        // AirPlay not supported using managed media sources
        this.deps.playbackSource.disableRemotePlayback = true

        this.streams.forEach((stream) => {
            this.deps.drmController.initializeForPlayback(
                stream.streamingQuality,
                this.disposeAbort
            )
        })
        this.deps.playbackSource.src =
            this.deps.mediaSourceController.createUrl()
        this.callOnStreams('activate', loadOptions)

        // If an ad break is already active (preroll set before activation),
        // start playing it now.
        const activeBreak = this.deps.adController?.activeAdBreak
        if (activeBreak && activeBreak.ads.length > 0) {
            this._activeAdIndex = 0
            this.activateAdAtIndex(activeBreak, 0)
        }

        // Listen for timeUpdate to detect period changes.
        this.timeUpdateSub = this.deps.playbackController.on(
            'timeUpdate',
            () => {
                const time = this.deps.playbackController.currentTime
                this.preloadUpcomingAds(time)
                const cached = this._cachedPeriod
                if (
                    cached &&
                    time >= cached.startTime &&
                    time < cached.endTime
                ) {
                    return
                }
                this.updateQualities()
                this.updateQualitiesUnfiltered()
            }
        )
    }

    onDeactivated(): void {
        this.clearAdSubscriptions()
        if (this._currentAdTrack) {
            this._currentAdTrack.deactivate()
            this._currentAdTrack = null
        }
        this.activateOptions = null
        this.timeUpdateSub?.()
        this.timeUpdateSub = null
        this.callOnStreams('deactivate')

        this.deps.playbackSource.src = null
        this.deps.playbackSource.load()
    }

    /**
     * Switches playback to or from an ad track. When a non-null ad track is
     * provided, the outer MseTrack's streams are deactivated (without marking
     * the track as inactive in the TrackController) and the ad track is
     * activated. When null is provided, the ad track is deactivated and the
     * outer track resumes.
     */
    private static readonly AD_PLAYBACK_TIMEOUT_MS = 10_000

    setCurrentAdTrack(adTrack: Track | null): void {
        if (adTrack === this._currentAdTrack) return
        this.clearAdSubscriptions()
        if (this._currentAdTrack) {
            this._currentAdTrack.deactivate()
            this._currentAdTrack = null
        }
        if (adTrack) {
            this._adResumeTime = this.deps.playbackController.currentTime
            this._currentAdTrack = adTrack
            this.deps.adController?.setAdPlaying(true)
            // Deactivate outer track's streams without full deactivate.
            this.timeUpdateSub?.()
            this.timeUpdateSub = null
            this.callOnStreams('deactivate')
            this.deps.playbackSource.src = null
            // Activate the ad sub-track and always play (ads should auto-play).
            adTrack.activate({})
            this.deps.playbackController.play().catch(() => {
                logDebug(this, 'ad play rejected, skipping ad')
                this.advanceOrSkipAd()
            })
            // If the ad track errors, skip it and resume content.
            this._adErrorSub = adTrack.on('error', (event) => {
                logDebug(this, 'ad track error, skipping:', event.error)
                this.dispatch('error', event)
                this.advanceOrSkipAd()
            })
            // Detect ad completion. Use both the playback controller's ended
            // event and a timeUpdate-based loop detection as fallback.
            let adPeakTime = 0
            const onAdDone = () => {
                if (this._currentAdTrack !== adTrack) return
                logDebug(this, 'ad ended, resuming content')
                this.advanceOrSkipAd()
            }
            const endedUnsub = this.deps.playbackController.on('ended', onAdDone)
            const timeUnsub = this.deps.playbackController.on(
                'timeUpdate',
                () => {
                    if (this._currentAdTrack !== adTrack) return
                    const time = this.deps.playbackController.currentTime
                    if (time > adPeakTime) adPeakTime = time
                    if (adPeakTime > 2 && time < adPeakTime - 2) onAdDone()
                }
            )
            this._adEndedSub = () => { endedUnsub(); timeUnsub() }
            // If the ad doesn't start playing within a timeout, skip it.
            this._adTimeoutId = setTimeout(() => {
                this._adTimeoutId = null
                if (
                    this._currentAdTrack === adTrack &&
                    this.deps.playbackController.currentTime === 0
                ) {
                    logDebug(this, 'ad playback timeout, skipping')
                    this.advanceOrSkipAd()
                }
            }, MseTrack.AD_PLAYBACK_TIMEOUT_MS)
        } else if (this.activateOptions) {
            this.deps.adController?.setAdPlaying(false)
            // Resume outer track at the saved position.
            this.onActivated(this.activateOptions)
            this.deps.playbackController
                .seekTo(this._adResumeTime)
                .then(() => this.deps.playbackController.play())
                .catch(() => {})
        }
    }

    /**
     * Advances to the next ad in the active break, or skips the break if
     * this was the last ad.
     */
    advanceOrSkipAd(): void {
        const activeBreak = this.deps.adController?.activeAdBreak
        if (activeBreak && this._activeAdIndex + 1 < activeBreak.ads.length) {
            this._activeAdIndex++
            this.activateAdAtIndex(activeBreak, this._activeAdIndex)
        } else {
            this.deps.adController?.skipAd()
        }
    }

    private activateAdAtIndex(adBreak: AdBreakInfo, index: number): void {
        const ad = adBreak.ads[index]
        const adTrack = this.deps.adController?.getAdTrack(ad.id)
        if (adTrack) {
            this.setCurrentAdTrack(adTrack)
        }
    }

    private clearAdSubscriptions(): void {
        this._adErrorSub?.()
        this._adErrorSub = null
        this._adEndedSub?.()
        this._adEndedSub = null
        if (this._adTimeoutId != null) {
            clearTimeout(this._adTimeoutId)
            this._adTimeoutId = null
        }
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

    private static readonly AD_PRELOAD_SECONDS = 20

    private preloadUpcomingAds(time: number): void {
        const adController = this.deps.adController
        if (!adController) return
        for (const adBreak of adController.adBreaks) {
            if (time < adBreak.startTime - MseTrack.AD_PRELOAD_SECONDS) continue
            if (time > adBreak.startTime) continue
            for (const ad of adBreak.ads) {
                if (this._preloadedAdIds.has(ad.id)) continue
                const track = adController.getAdTrack(ad.id)
                if (!track) continue
                this._preloadedAdIds.add(ad.id)
                track.preload({ prefetchPriority: 0 }, {})
            }
        }
    }

    dispose(): void {
        logDebug(this, 'dispose')
        this.clearAdSubscriptions()
        this.timeUpdateSub?.()
        this.timeUpdateSub = null
        this.clearStreams()
        super.dispose()
    }
}
