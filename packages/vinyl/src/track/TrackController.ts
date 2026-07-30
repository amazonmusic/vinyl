/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type AnyRecord,
    countElements,
    createDisposer,
    type Disposable,
    EventHostImpl,
    first,
    getOrSet,
    logDebug,
    logInfo,
    LruCache,
    type Maybe,
    noop,
    type ReadonlyEventHost,
    type TimeoutId,
} from '@amazon/vinyl-util'
import type { PlaybackController } from '../playback/PlaybackController'
import type { ReadonlyTrack, Track, TrackUri } from './Track'
import type { TrackFactory, TrackLoadOptions } from './TrackFactory'
import type { ChangeEvent } from '../event/ChangeEvent'
import type { AdBreakPlacement, AdController, AdInfo } from '../ad/AdBreak'
import { inferTrackType } from '../ad/inferTrackType'

export interface TrackControllerEventMap<
    TrackLoadOptionsType extends TrackLoadOptions,
> {
    /**
     * Emitted when the current track is changing.
     * This is emitted before the previous track has been deactivated and
     * new track has been activated.
     */
    readonly currentTrackChanging: ChangeEvent<ReadonlyTrack | null>

    /**
     * Emitted when the current track has changed.
     * If there is a queue change, the currentTrackChange event is always emitted first.
     * This is emitted after the previous track has been deactivated and
     * new track has been activated.
     */
    readonly currentTrackChange: ChangeEvent<ReadonlyTrack | null>

    /**
     * Dispatched when the queue has changed.
     */
    readonly queueChange: ChangeEvent<readonly TrackLoadOptionsType[]>

    /**
     * Emitted when the last track of the playback queue has ended.
     * When the last track in a queue has ended, the track will not change and therefore a `currentTrackChange`
     * event will not be emitted.
     */
    readonly queueEnded: AnyRecord
}

export const ALL_TRACK_CONTROLLER_EVENTS = [
    'currentTrackChanging',
    'currentTrackChange',
    'queueChange',
    'queueEnded',
] as const satisfies readonly (keyof TrackControllerEventMap<any>)[]

/**
 * A readonly interface to the track controller.
 */
export interface ReadonlyTrackController<
    TrackLoadOptionsType extends TrackLoadOptions,
> extends ReadonlyEventHost<TrackControllerEventMap<TrackLoadOptionsType>> {
    /**
     * Returns the current track.
     */
    readonly currentTrack: ReadonlyTrack | null

    /**
     * Returns the ad track currently playing over the content track, or null
     * when no ad is playing. This is exposed separately from
     * {@link currentTrack}: while an ad plays, {@link currentTrack} continues
     * to reference the (suspended) content track and the queue is unchanged.
     */
    readonly currentAdTrack: ReadonlyTrack | null

    /**
     * Returns the current queue of TrackLoadOptions.
     * Observe 'queueChange' for changes to this queue.
     */
    readonly queue: readonly TrackLoadOptionsType[]

    /**
     * Returns true if there is at least one track in the queue.
     */
    hasNext(): boolean

    /**
     * Returns true if the track with the given URI is cached.
     */
    isTrackCached(uri: TrackUri): boolean

    /**
     * Returns the cached track for the given URI, or null if the track is not cached.
     */
    getCachedTrack(uri: TrackUri): ReadonlyTrack | null

    /**
     * Returns an iterator of currently cached tracks.
     */
    getCachedTracks(): IterableIterator<ReadonlyTrack>
}

/**
 * Responsible for queuing track load configurations.
 * This is the authority for which is the current track.
 */
export interface TrackController<
    TrackLoadOptionsType extends TrackLoadOptions,
> extends ReadonlyTrackController<TrackLoadOptionsType> {
    /**
     * Preloads the given list of tracks.
     * The tracks provided will not be enqueued.
     * The track controller's cache size will automatically increase to accommodate the request.
     *
     * Prefetch priority note:
     * Tracks have a prefetch priority, later calls to preload will have a higher precedence than previous calls.
     * Previous tracks given to `preload` will drop off when they are evicted from the cache. This is dependent on
     * cache size.
     *
     * @param loadOptionsList
     */
    preload(...loadOptionsList: readonly TrackLoadOptionsType[]): void

    /**
     * Sets the current queue to the provided track list.
     * When the track ends, the next will be played.
     *
     * `load` does not begin playback. Call `play()` after a load to start playback.
     * Browser autoplay policies may require the first call to `play()` to be in response to a user interaction
     * such as a click, touch, keypress, or voice event.
     *
     * Note that if the current track is the first track provided in the list, that track will be restarted.
     * To set the queue without unloading the current track, use {@link clearQueue} followed by {@link enqueue}.
     *
     * @param loadOptionsList A list of load configuration objects to set as a playback queue.
     */
    load(...loadOptionsList: readonly TrackLoadOptionsType[]): void

    /**
     * Unloads the active track and clears the queue.
     * This is the same as calling {@link load} with zero parameters.
     */
    unload(): void

    /**
     * Appends the given tracks to the current queue.
     *
     * @param loadOptionsList The track load configurations to append.
     */
    enqueue(...loadOptionsList: readonly TrackLoadOptionsType[]): void

    /**
     * Activates the next track in the queue.
     * If the media is not paused the next track will begin playing automatically.
     *
     * @see ReadonlyTrackController.hasNext
     */
    next(): void

    /**
     * Clears all fetched fragments and source buffers.
     * Playback will be interrupted, and streaming will resume again when data has been fetched and buffered.
     * This should be called if a change has been made where the user would expect an immediate change,
     * for example, changing streaming quality from SD to HD.
     *
     * Does not unload manifests.
     */
    clearPrefetch(): void

    /**
     * Clears the track cache and unloads the current track.
     */
    clearTrackCache(): void

    /**
     * Clears the current queue.
     * Does not stop the current track or affect the prefetched cache.
     */
    clearQueue(): void

    /**
     * Resets the current track's error state.
     */
    reset(): void

    /**
     * Disposes and re-creates the current track from scratch, then reactivates
     * it, preserving the current playback position. Unlike {@link reset}, this
     * rebuilds the underlying MediaSource, which is required to recover from
     * failures that poison the media pipeline (e.g. a decode/append failure).
     * No-op when there is no current track.
     */
    reloadCurrentTrack(): void
}

export interface TrackControllerImplDeps<
    TrackLoadOptionsType extends TrackLoadOptions,
> {
    readonly trackFactory: TrackFactory<TrackLoadOptionsType>

    readonly playbackController: PlaybackController

    readonly adController?: AdController | null
}

export interface TrackControllerImplOptions {
    /**
     * When tracks are queued, the number of tracks to prefetch ahead of the current track.
     * Default: 2
     */
    readonly trackPrefetchCount: number

    /**
     * The number of seconds before load calls will time out if the first track's metadata is not loaded within
     * this time.
     * Default: 60
     */
    readonly loadTimeout: number

    /**
     * The number of tracks that may be preloaded at one time (not counting queue prefetch).
     * This extends the track cache capacity and allows a certain number of tracks no longer in the queue to remain
     * cached.
     *
     * Default: 2
     */
    readonly preloadCapacity: number
}

const defaultTrackControllerImplOptions = {
    trackPrefetchCount: 2,
    loadTimeout: 60,
    preloadCapacity: 2,
} as const satisfies TrackControllerImplOptions

/**
 * Track priority will be assigned based on calls to `preload`.
 * Segment background prefetching is shared if there are multiple players instances (in the rare case there would be
 * multiple players). Having a global incrementing trackPriority prevents one player from starving another.
 */
export const trackPriority = {
    value: 0,
}

export class TrackControllerImpl<TrackLoadOptionsType extends TrackLoadOptions>
    extends EventHostImpl<TrackControllerEventMap<TrackLoadOptionsType>>
    implements TrackController<TrackLoadOptionsType>, Disposable
{
    get [Symbol.toStringTag](): string {
        return 'TrackControllerImpl'
    }

    // When tracks are preloaded, the cache capacity may expand automatically to accommodate.
    private _autoPreloadCapacity = 0
    private readonly trackCache = new LruCache<string, Track>(0)
    private _queue: readonly TrackLoadOptionsType[] = []
    private _current: TrackLoadOptionsType | null = null
    private readonly disposer = createDisposer()
    private _options: TrackControllerImplOptions =
        defaultTrackControllerImplOptions

    private trackEndedTimeoutId: TimeoutId | null = null
    // Ad playback state. The ad track plays "over" the suspended content track;
    // it is not part of the queue or the track cache.
    private _adTrack: Track | null = null
    private _adTrackAdId: string | null = null
    private _adResumeTime: number = 0
    private _adTimeoutId: TimeoutId | null = null
    // The placement of the break currently playing. A postroll finalizes the
    // queue on completion (content is over) rather than resuming content.
    private _activeBreakPlacement: AdBreakPlacement | null = null
    // True while an ad ends naturally (its `ended` fired). Content should resume
    // playing in that case; a natural end leaves the element paused, which must
    // not be mistaken for the user having paused during the ad.
    private _adEndedNaturally = false
    // Ad tracks that have been created for preloading, keyed by ad id, so they
    // can be reused on activation and disposed when content changes.
    private readonly _adTrackCache = new Map<string, Track>()
    private readonly _preloadedAdIds = new Set<string>()

    constructor(
        private readonly deps: TrackControllerImplDeps<TrackLoadOptionsType>,
        initialOptions?: Partial<TrackControllerImplOptions>
    ) {
        super()
        const { add } = this.disposer

        this.trackCache.onEvicting = (track) => {
            // Do not evict tracks within the prefetch range.
            return (
                this.prefetched.find((value) => value.uri === track.uri) == null
            )
        }

        this.trackCache.onEvict = (track) => {
            logDebug(this, `Disposing track: ${track.uri}`)
            track.dispose()
            return true
        }

        add(
            deps.playbackController.on('ended', () => {
                if (deps.adController?.adPlaying) {
                    // The current ad played to its end. Advancing to the next
                    // ad or resuming content should continue playing (the
                    // natural end leaves the element paused).
                    this._adEndedNaturally = true
                    deps.adController.advanceOrSkipAd()
                    this._adEndedNaturally = false
                    return
                }
                // A postroll's start sits at the content end, so the playhead
                // rarely emits a timeUpdate inside it before `ended`. Give the
                // ad controller a chance to activate a pending postroll. Mark
                // the break as a postroll up front so that even if it resolves
                // to no ads, its completion still finalizes the queue instead
                // of stalling.
                if (deps.adController?.enterPostrollIfPending()) {
                    this._activeBreakPlacement = 'postroll'
                    return
                }
                this.finishContent()
            })
        )

        const adController = deps.adController
        if (adController) {
            add(
                adController.on('adBreakChange', (event) => {
                    if (event.current) {
                        // A break is active (entering or advancing an ad).
                        // Switch playback to the current ad's track.
                        this._activeBreakPlacement = event.current.placement
                        const ad = adController.currentAd
                        if (ad) this.playAdTrack(ad)
                    } else if (this._activeBreakPlacement === 'postroll') {
                        // A postroll finished: content is over, so finalize the
                        // queue rather than replaying the content track.
                        this._activeBreakPlacement = null
                        this.finishPostroll()
                    } else if (this._adTrack) {
                        // The break ended — resume the content track.
                        this._activeBreakPlacement = null
                        this.resumeContent()
                    }
                })
            )
            add(
                deps.playbackController.on('timeUpdate', () => {
                    this.preloadUpcomingAds(
                        adController,
                        deps.playbackController.currentTime
                    )
                })
            )
        }

        this.configure(initialOptions)
    }

    /**
     * Creates (or reuses a preloaded) ad track for the given ad and switches
     * playback to it, suspending the content track on the first ad of a break.
     */
    private playAdTrack(ad: AdInfo): void {
        if (this._adTrackAdId === ad.id && this._adTrack) return
        const track = this.getOrCreateAdTrack(ad)
        if (!track) {
            // No playable track for this ad — advance past it.
            this.deps.adController?.advanceOrSkipAd()
            return
        }
        if (this._adTrack) {
            // Advancing to the next ad within the same break.
            this._adTrack.deactivate()
        } else if (this._currentTrack?.active) {
            // First ad of the break — save the resume position, then suspend
            // content.
            this._adResumeTime = this.deps.playbackController.currentTime
            this._currentTrack.deactivate()
        }
        this._adTrack = track
        this._adTrackAdId = ad.id
        track.activate({})
        this.deps.playbackController.play().catch(() => {
            if (this.disposer.disposed) return
            this.deps.adController?.advanceOrSkipAd()
        })
        // Timeout: if the ad doesn't start within 10s, skip it. The timeout is
        // cleared on resume/advance and on dispose (via clearAdTracks).
        if (this._adTimeoutId) clearTimeout(this._adTimeoutId)
        this._adTimeoutId = setTimeout(() => {
            this._adTimeoutId = null
            if (
                this._adTrack === track &&
                this.deps.playbackController.currentTime === 0
            ) {
                logDebug(this, 'ad playback timeout, skipping')
                this.deps.adController?.advanceOrSkipAd()
            }
        }, AD_PLAYBACK_TIMEOUT_MS)
    }

    private resumeContent(): void {
        // Decide whether to resume playing:
        //  - Ad ended naturally: continue playing (the ended element is paused,
        //    but the user was watching and expects content to follow).
        //  - User skipped: honor the current intent — stay paused if the user
        //    had paused during the ad, otherwise resume playing. Read this
        //    BEFORE clearAdPlayback(), whose deactivate() pauses the element.
        const playback = this.deps.playbackController
        const shouldPlay =
            this._adEndedNaturally || !playback.paused || playback.playIsPending
        this.clearAdPlayback()
        if (this._currentTrack && !this._currentTrack.active) {
            // Reactivate with the resume time as startTime so the track seeks
            // there as part of its normal activation (which waits for the
            // MediaSource to be ready before seeking).
            const config = this._current?.config ?? {}
            this._currentTrack.activate({
                ...config,
                startTime: this._adResumeTime,
            })
            if (shouldPlay) playback.play().catch(() => {})
        }
    }

    /**
     * Handles the end of a postroll break. Content is over, so advance to the
     * next queued track if there is one; otherwise reset the content track to
     * its start (loaded and paused) and finalize the queue.
     */
    private finishPostroll(): void {
        if (this.hasNext()) {
            this.clearAdPlayback()
            // next() reactivates the upcoming track and preserves play state.
            this.next()
            return
        }
        // Content is over. Tear down the ad and reactivate the content track at
        // its start so the element keeps a source (parked at 0, not replaying
        // the end) without auto-playing.
        this.clearAdPlayback()
        if (this._currentTrack && !this._currentTrack.active) {
            this._currentTrack.activate(this._current?.config ?? {})
        }
        logInfo(this, 'queueEnded')
        this.dispatch('queueEnded', {})
    }

    /**
     * Tears down the active ad track and its timeout without touching the
     * content track or the preload cache.
     */
    private clearAdPlayback(): void {
        if (this._adTimeoutId) {
            clearTimeout(this._adTimeoutId)
            this._adTimeoutId = null
        }
        if (this._adTrack) {
            this._adTrack.deactivate()
            this._adTrack = null
            this._adTrackAdId = null
        }
    }

    /**
     * Finalizes end-of-content: advances to the next queued track after a frame
     * delay, or dispatches `queueEnded` when the queue is empty.
     */
    private finishContent(): void {
        this.trackEndedTimeoutId = setTimeout(() => {
            this.trackEndedTimeoutId = null
            if (this.hasNext()) {
                this.next()
            } else {
                logInfo(this, 'queueEnded')
                this.dispatch('queueEnded', {})
            }
        })
    }

    /**
     * Returns the ad track for the given ad, creating and caching it if needed.
     * Returns null when no track type can be inferred from the ad URI.
     */
    private getOrCreateAdTrack(ad: AdInfo): Track | null {
        const cached = this._adTrackCache.get(ad.id)
        if (cached) return cached
        if (!ad.uri) return null
        const type = inferTrackType(ad.uri)
        if (!type) return null
        const track = this.deps.trackFactory.createTrack({
            type,
            uri: ad.uri,
        } as unknown as TrackLoadOptionsType)
        this._adTrackCache.set(ad.id, track)
        return track
    }

    /**
     * Preloads ad tracks for any break the playhead is approaching (within
     * {@link AD_PRELOAD_SECONDS}), resolving each break's ad list lazily.
     */
    private preloadUpcomingAds(adController: AdController, time: number): void {
        for (const adBreak of adController.adBreaks) {
            if (time < adBreak.startTime - AD_PRELOAD_SECONDS) continue
            if (time > adBreak.startTime) continue
            void adBreak.ads().then((ads) => {
                if (this.disposer.disposed) return
                for (const ad of ads) {
                    if (this._preloadedAdIds.has(ad.id)) continue
                    const track = this.getOrCreateAdTrack(ad)
                    if (!track) continue
                    this._preloadedAdIds.add(ad.id)
                    track.preload({ prefetchPriority: 0 }, {})
                }
            })
        }
    }

    /**
     * Disposes all ad tracks and clears ad playback state. Called when the
     * content track changes so ads owned by the previous content don't linger.
     */
    private clearAdTracks(): void {
        if (this._adTimeoutId) {
            clearTimeout(this._adTimeoutId)
            this._adTimeoutId = null
        }
        if (this._adTrack) {
            this._adTrack.deactivate()
            this._adTrack = null
            this._adTrackAdId = null
        }
        for (const track of this._adTrackCache.values()) track.dispose()
        this._adTrackCache.clear()
        this._preloadedAdIds.clear()
        this._activeBreakPlacement = null
        // Fully reset the ad controller: break and ad ids are only unique
        // within a single presentation, so retaining any state (including skip
        // history) across a content change would let the previous content's
        // ids collide with the new one's.
        this.deps.adController?.reset()
    }

    private clearTrackEndedTimeout() {
        if (this.trackEndedTimeoutId) {
            clearTimeout(this.trackEndedTimeoutId)
            this.trackEndedTimeoutId = null
        }
    }

    /**
     * Returns the currently set configuration.
     */
    get options(): TrackControllerImplOptions {
        return this._options
    }

    /**
     * Configures this track queue from the provided partial options.
     *
     * @param options
     */
    configure(options: Maybe<Partial<TrackControllerImplOptions>>) {
        logDebug(this, 'configure', options)
        this._options = {
            ...this._options,
            ...options,
        }
        this.checkCacheCapacity()
    }

    /**
     * Checks if the cache capacity needs to be changed.
     */
    private checkCacheCapacity() {
        const capacity =
            this.preloadCapacity + this._options.trackPrefetchCount + 1
        if (capacity !== this.trackCache.capacity) {
            logDebug(this, 'track cache capacity changed:', capacity)
            this.trackCache.capacity = capacity
        }
    }

    get queue(): readonly TrackLoadOptionsType[] {
        return this._queue
    }

    /**
     * Returns the subset of the queue that should be prefetched.
     * @private
     */
    private get prefetched(): readonly TrackLoadOptionsType[] {
        const tracks: TrackLoadOptionsType[] = []
        if (this._current) tracks.push(this._current)
        tracks.push(...this._queue.slice(0, this.options.trackPrefetchCount))
        return tracks
    }

    isTrackCached(uri: TrackUri): boolean {
        return this.trackCache.has(uri)
    }

    getCachedTrack(uri: TrackUri): ReadonlyTrack | null {
        return this.trackCache.get(uri) ?? null
    }

    getCachedTracks(): IterableIterator<ReadonlyTrack> {
        return this.trackCache.values()
    }

    /**
     * Returns the current preload capacity.
     * This automatically increases when preload is called with more tracks than the current capacity.
     */
    get preloadCapacity(): number {
        return Math.max(
            this._autoPreloadCapacity,
            this._options.preloadCapacity
        )
    }

    private validateLoadOptions = (loadOptions: TrackLoadOptionsType) =>
        this.deps.trackFactory.validate(loadOptions)

    preload(...loadOptionsList: readonly TrackLoadOptionsType[]): void {
        logDebug(this, `preload ${loadOptionsList.length} items`)
        loadOptionsList.forEach(this.validateLoadOptions)
        this._preload(loadOptionsList)
    }

    private _preload(loadOptionsList: readonly TrackLoadOptionsType[]): void {
        const prefetched = this.prefetched
        // Calculate the required preload capacity as the number of tracks requested that are not within the
        // prefetch window. If this value is greater than the current preloadCapacity, increase the cache size.
        const requiredPreloadCapacity = countElements(
            loadOptionsList,
            (loadOptions) => {
                return (
                    prefetched.find((element) => {
                        return element.uri === loadOptions.uri
                    }) == null
                )
            }
        )
        if (this._autoPreloadCapacity < requiredPreloadCapacity) {
            this._autoPreloadCapacity = requiredPreloadCapacity
            this.checkCacheCapacity()
        }
        // Tracks requested to preload will have a priority where the first track in the list (next track) has
        // the highest precedence. (Higher priority values take precedence)
        trackPriority.value += loadOptionsList.length
        let priority = trackPriority.value
        for (const loadOptions of loadOptionsList) {
            const track = this.getOrCreateTrack(loadOptions.uri, loadOptions)
            track.preload(
                {
                    prefetchPriority: priority--,
                },
                loadOptions.config ?? {}
            )
        }
    }

    load(...loadOptionsList: readonly TrackLoadOptionsType[]): void {
        logDebug(this, `load ${loadOptionsList.length} items`)
        loadOptionsList.forEach(this.validateLoadOptions)
        this.clearTrackEndedTimeout()
        this.clearAdTracks()
        this._current = loadOptionsList[0] ?? null
        const previousQueue = this._queue
        this._queue = loadOptionsList.slice(1)
        this._preload(this.prefetched)
        this.activateCurrent()
        this.dispatch('queueChange', {
            previous: previousQueue,
            current: this._queue,
        })
    }

    unload() {
        this.load()
    }

    enqueue(...loadOptionsList: readonly TrackLoadOptionsType[]): void {
        logDebug(this, `enqueue ${loadOptionsList.length} items`)
        loadOptionsList.forEach(this.validateLoadOptions)
        const previousQueue = this._queue
        this._queue = this._queue.concat(loadOptionsList)
        this._preload(this.prefetched)
        if (this.currentTrack == null && this.hasNext()) this.next()
        this.dispatch('queueChange', {
            previous: previousQueue,
            current: this._queue,
        })
    }

    hasNext(): boolean {
        return this._queue.length > 0
    }

    next(): void {
        this.clearTrackEndedTimeout()
        this.clearAdTracks()
        const playbackController = this.deps.playbackController
        const shouldPlay =
            playbackController.ended || !playbackController.paused
        const next = first(this._queue)
        const previousQueue = this._queue
        this._queue = this._queue.slice(1)
        this._current = next ?? null
        logDebug(this, 'next, nextTrack:', this._current)
        if (
            this.options.trackPrefetchCount > 0 &&
            this._queue.length >= this.options.trackPrefetchCount
        ) {
            this._preload([this._queue[this.options.trackPrefetchCount - 1]])
        }
        this.activateCurrent()
        if (shouldPlay) void playbackController.play().catch(noop)
        this.dispatch('queueChange', {
            previous: previousQueue,
            current: this._queue,
        })
    }

    clearTrackCache() {
        logDebug(this, 'clearTrackCache')
        this.clearTrackEndedTimeout()
        this.clearAdTracks()
        const previousQueue = this._queue
        this._queue = []
        this.trackCache.forEach((track) => {
            track.dispose()
        })
        this.trackCache.clear()
        this._autoPreloadCapacity = 0
        this.checkCacheCapacity()
        this.clearCurrentTrack()
        this.dispatch('queueChange', {
            previous: previousQueue,
            current: this._queue,
        })
    }

    clearPrefetch(): void {
        for (const cachedTrack of this.trackCache.values()) {
            cachedTrack.clearPrefetch()
        }
    }

    clearQueue(): void {
        this.clearTrackEndedTimeout()
        const previous = this._queue
        this._queue = []
        this.dispatch('queueChange', {
            previous,
            current: this._queue,
        })
    }

    /**
     * If the given track id is the current track or in the cache, returns that track.
     * Otherwise, constructs a new track, adds it to the cache, and returns it.
     *
     * @param uri The unique resource identifier.
     * @param loadOptions
     * @private
     */
    private getOrCreateTrack(
        uri: TrackUri,
        loadOptions: TrackLoadOptionsType
    ): Track {
        return getOrSet(this.trackCache, uri, () => {
            const newTrack = this.deps.trackFactory.createTrack(loadOptions)
            this.trackCache.set(uri, newTrack)
            return newTrack
        })
    }

    /**
     * Get the current track from cache or create a new track, then activates that track.
     */
    private activateCurrent(): void {
        const loadOptions = this._current
        if (!loadOptions) {
            this.clearCurrentTrack()
            return
        }
        this.setCurrentTrack(
            this.getOrCreateTrack(loadOptions.uri, loadOptions),
            loadOptions
        )
    }

    private _currentTrack: Track | null = null
    get currentTrack(): ReadonlyTrack | null {
        return this._currentTrack
    }

    get currentAdTrack(): ReadonlyTrack | null {
        return this._adTrack
    }

    /**
     * Sets the current track. If the given track is already current, it will be de-activated and re-activated and
     * the currentTrackChange event will still be emitted.
     * The same track may be in the queue multiple times.
     */
    private setCurrentTrack(
        value: Track | null,
        loadOptions: TrackLoadOptionsType | null
    ) {
        const previousTrack = this._currentTrack
        this.dispatch('currentTrackChanging', {
            previous: previousTrack,
            current: value,
        })
        this._currentTrack = value
        if (previousTrack?.active === true) previousTrack.deactivate()
        const loadOptionsConfig = loadOptions?.config ?? {}
        if (value?.active === false) value.activate(loadOptionsConfig)
        logDebug(
            this,
            `currentTrackChange, previous: ${previousTrack} current: ${value}`
        )
        this.dispatch('currentTrackChange', {
            previous: previousTrack,
            current: value,
        })
    }

    private clearCurrentTrack() {
        this.setCurrentTrack(null, null)
    }

    reset() {
        this._currentTrack?.reset()
    }

    reloadCurrentTrack() {
        const loadOptions = this._current
        if (!loadOptions || !this._currentTrack) {
            logDebug(this, 'reloadCurrentTrack no-op')
            return
        }
        logDebug(this, 'reloadCurrentTrack', loadOptions.uri)
        // While an ad is playing the content track is suspended and the ad
        // owns the media element. Rebuild the content track in place without
        // reactivating it (or touching playback); it will be reactivated at
        // the saved resume time when the break ends.
        if (this._adTrack) {
            const stale = this._currentTrack
            this.setCurrentTrack(null, null)
            this.trackCache.delete(loadOptions.uri)
            stale.dispose()
            this._currentTrack = this.getOrCreateTrack(
                loadOptions.uri,
                loadOptions
            )
            return
        }
        // Preserve the playhead and play state across the rebuild.
        const resumeTime = this.deps.playbackController.currentTime
        const wasPlaying =
            !this.deps.playbackController.paused ||
            this.deps.playbackController.playIsPending
        // Deactivate, evict, and dispose the poisoned track so a fresh one
        // (with a new MediaSource) is created on reactivation.
        const stale = this._currentTrack
        this.setCurrentTrack(null, null)
        this.trackCache.delete(loadOptions.uri)
        stale.dispose()
        // Recreate and reactivate from the retained load options.
        this.activateCurrent()
        if (resumeTime > 0) {
            this.deps.playbackController.seekTo(resumeTime).catch(() => {})
        }
        // Reactivation attaches a fresh MediaSource but does not resume
        // playback; restore the prior play state.
        if (wasPlaying) {
            this.deps.playbackController.play().catch(() => {})
        }
    }

    dispose() {
        logDebug(this, 'dispose')
        super.dispose()
        this.clearTrackCache()
        this.disposer.dispose()
    }
}

/**
 * How long to wait for an ad to begin playing before skipping it, in ms.
 */
const AD_PLAYBACK_TIMEOUT_MS = 10_000

/**
 * How far ahead of a break's start to begin preloading its ad tracks, in
 * seconds.
 */
const AD_PRELOAD_SECONDS = 20
