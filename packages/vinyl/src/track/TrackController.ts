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
import type { PlaybackController } from '@/playback/PlaybackController'
import type { ReadonlyTrack, Track, TrackUri } from '@/track/Track'
import type { TrackFactory, TrackLoadOptions } from '@/track/TrackFactory'
import type { ChangeEvent } from '@/event/ChangeEvent'

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
}

export interface TrackControllerImplDeps<
    TrackLoadOptionsType extends TrackLoadOptions,
> {
    readonly trackFactory: TrackFactory<TrackLoadOptionsType>

    readonly playbackController: PlaybackController
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
                this.trackEndedTimeoutId = setTimeout(() => {
                    // Adds a frame delay to allow applications an opportunity to respond to 'ended' events before the
                    // track is changed.
                    this.trackEndedTimeoutId = null
                    if (this.hasNext()) {
                        this.next()
                    } else {
                        logInfo(this, 'queueEnded')
                        this.dispatch('queueEnded', {})
                    }
                })
            })
        )
        this.configure(initialOptions)
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

    dispose() {
        logDebug(this, 'dispose')
        super.dispose()
        this.clearTrackCache()
        this.disposer.dispose()
    }
}
