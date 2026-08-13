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
    IllegalStateError,
    logDebug,
    logInfo,
    logWarn,
    LruCache,
    type Maybe,
    noop,
    type ReadonlyEventHost,
    type Unsubscribe,
} from '@amazon/vinyl-util'
import type { PlaybackController } from '../playback/PlaybackController'
import type { ReadonlyTrack, Track, TrackUri } from './Track'
import type { TrackFactory, TrackLoadOptions } from './TrackFactory'
import type { ChangeEvent } from '../event/ChangeEvent'
import type { AdController } from '../ad/AdController'
import type { AdInfo } from '../ad/AdBreakInfo'

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
     *
     * Will be emitted before currentTrackChange.
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
     * Clears the track cache, unloads the current track, and clears the queue.
     */
    clearTrackCache(): void

    /**
     * Clears the current queue.
     * Does not stop the current track or affect the prefetched cache.
     */
    clearQueue(): void

    /**
     * Resets the current track's error state.
     *
     * @param hard If true, the track will reset the playback state and
     * recreate media sources.
     */
    reset(hard?: boolean): void
}

export interface TrackControllerImplDeps<
    TrackLoadOptionsType extends TrackLoadOptions,
> {
    readonly trackFactory: TrackFactory<TrackLoadOptionsType>

    readonly playbackController: PlaybackController

    readonly adController: AdController

    readonly adTrackLoadOptionsProvider: AdTrackLoadOptionsProvider<TrackLoadOptionsType>
}

export type AdTrackLoadOptionsProvider<
    TrackLoadOptionsType extends TrackLoadOptions,
> = (adInfo: AdInfo) => Promise<TrackLoadOptionsType>

export interface TrackControllerImplOptions {
    /**
     * When tracks are queued, the number of tracks to prefetch ahead of the current track.
     * Default: 2
     */
    readonly trackPrefetchCount: number

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
    // A monotonically increasing id for a queue change, to allow for queue changes during events.
    private queueIdx = 0
    private _queue: readonly TrackLoadOptionsType[] = []
    private _current: TrackLoadOptionsType | null = null
    private _adParent: TrackLoadOptionsType | null = null
    private _currentTrack: Track | null = null
    // Active track listeners
    private activeTrackSub: Unsubscribe | null = null

    private readonly disposer = createDisposer()
    private _options: TrackControllerImplOptions =
        defaultTrackControllerImplOptions

    constructor(
        private readonly deps: TrackControllerImplDeps<TrackLoadOptionsType>,
        initialOptions?: Partial<TrackControllerImplOptions>
    ) {
        super()
        const { add } = this.disposer
        const { playbackController } = deps

        this.trackCache.onEvicting = (track) => {
            // Do not evict tracks within the prefetch range.
            return (
                this.getPrefetched().find((value) => value.uri === track.uri) ==
                null
            )
        }

        this.trackCache.onEvict = (track) => {
            logDebug(this, `Disposing track: ${track.uri}`)
            track.dispose()
            return true
        }

        add(playbackController.on('ended', this.onTrackEnded))

        this.initializeAdHandling()
        this.configure(initialOptions)
    }

    private initializeAdHandling() {
        const { add } = this.disposer
        const { adController, adTrackLoadOptionsProvider } = this.deps
        add(
            adController.on('adEntered', (event) => {
                const interrupted = this.getQueueInterrupted()
                if (event.ad.uri) {
                    // Infer the track load options from the ad.
                    adTrackLoadOptionsProvider(event.ad)
                        .then((adTrack) => {
                            if (!interrupted()) {
                                this.setQueue(adTrack, this._queue, {
                                    fromAd: true,
                                    shouldPlay: true,
                                })
                            }
                        })
                        .catch((error) => {
                            if (!interrupted()) adController.failAd(error)
                        })
                }
            })
        )

        add(
            adController.on('adCompleted', (event) => {
                const adParent = this._adParent
                if (!adParent) {
                    logWarn(this, 'ad completed without a parent media track')
                    return
                }
                logDebug(this, 'adCompleted')
                const isPreroll = event.adBreak.placement === 'preroll'
                const isPostroll = event.adBreak.placement === 'postroll'
                const interrupted = this.getQueueInterrupted()
                setTimeout(() => {
                    // Delay a frame before changing the queue to allow other handlers of adCompleted
                    // to query the current ad track.
                    if (interrupted()) return
                    if (isPostroll && this.hasNext()) {
                        this.next()
                    } else {
                        const startTime = isPreroll
                            ? adParent.config?.startTime
                            : event.resumeOffset
                        // Resume the main track.
                        this.setQueue(
                            {
                                ...adParent,
                                config: {
                                    ...adParent.config,
                                    startTime,
                                },
                            },
                            this._queue,
                            {
                                fromAd: true,
                                shouldPlay: !isPostroll,
                            }
                        )
                        if (isPostroll) {
                            logInfo(this, 'queueEnded after postroll ad(s)')
                            this.dispatch('queueEnded', {})
                        }
                    }
                })
            })
        )
    }

    /**
     * The current track has ended naturally. On the next tick advance the queue or emit queue ended.
     */
    private onTrackEnded = () => {
        const { adController } = this.deps

        const interrupted = this.getQueueInterrupted()
        const ad = adController.currentAd

        if (!ad) {
            adController.enterPostroll()
            if (adController.currentAdBreak) {
                // There is a pending postroll, do not advance the queue,
                // a new adEntered event will fire.
                return
            }

            // Adds a frame delay to allow applications an opportunity to respond to 'ended' events before the
            // queue is advanced.
            setTimeout(() => {
                if (interrupted()) return
                if (this.hasNext()) {
                    this.next()
                } else {
                    logInfo(this, 'queueEnded')
                    this.dispatch('queueEnded', {})
                }
            })
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
    private getPrefetched(): readonly TrackLoadOptionsType[] {
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
        const prefetched = this.getPrefetched()
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
            this.preloadTrackAds(track, priority)
        }
    }

    /**
     * Ad preloading hook: when a main track's ads become known, its ad assets
     * are preloaded so that entering an ad break incurs no load latency.
     *
     * Not yet implemented; wired up in a follow-up change.
     */
    private preloadTrackAds(_track: Track, _basePriority: number): void {}

    load(...loadOptionsList: readonly TrackLoadOptionsType[]): void {
        logDebug(this, `load ${loadOptionsList.length} items`)
        loadOptionsList.forEach(this.validateLoadOptions)
        this.setQueue(loadOptionsList[0], loadOptionsList.slice(1))
    }

    unload() {
        this.load()
    }

    enqueue(...loadOptionsList: readonly TrackLoadOptionsType[]): void {
        logDebug(this, `enqueue ${loadOptionsList.length} items`)
        loadOptionsList.forEach(this.validateLoadOptions)
        this.setQueue(this._current, this._queue.concat(loadOptionsList))
        if (this.currentTrack == null && this.hasNext()) this.next()
    }

    hasNext(): boolean {
        return this._queue.length > 0
    }

    next(): void {
        const playbackController = this.deps.playbackController
        const shouldPlay =
            playbackController.ended || !playbackController.paused
        const next = first(this._queue)
        logDebug(this, 'next, nextTrack:', next)
        this.setQueue(next, this._queue.slice(1), { shouldPlay })
    }

    clearTrackCache() {
        logDebug(this, 'clearTrackCache')
        this.trackCache.forEach((track) => {
            track.dispose()
        })
        this.trackCache.clear()
        this._autoPreloadCapacity = 0
        this.checkCacheCapacity()
        this.setQueue(null, [])
    }

    clearPrefetch(): void {
        for (const cachedTrack of this.trackCache.values()) {
            cachedTrack.clearPrefetch()
        }
    }

    clearQueue(): void {
        // Clears the upcoming queue without unloading the current track.
        this.setQueue(this._current, [])
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
     * Sets the current track and following queue.
     *
     * If the given track is already current, it will be de-activated and re-activated and the currentTrackChange
     * event will still be emitted. The same track may be in the queue multiple times.
     */
    private setQueue(
        current: Maybe<TrackLoadOptionsType>,
        queue: readonly TrackLoadOptionsType[],
        options?: {
            /**
             * True if the queue change is from an ad event.
             */
            readonly fromAd?: boolean

            /**
             * If true, starts playback after the track has changed.
             */
            readonly shouldPlay?: boolean
        }
    ): void {
        const { adController, playbackController } = this.deps
        ++this.queueIdx
        const interrupted = this.getQueueInterrupted()
        const previousQueue = this._queue
        const previous = this._current
        const previousTrack = this._currentTrack
        if (previous !== current) {
            this.activeTrackSub?.()
            this.activeTrackSub = null
            // Update the current/queue pointers before materializing the track,
            // so cache eviction inside getOrCreateTrack protects the incoming
            // track and its prefetch window rather than the outgoing one.
            this._current = current ?? null
            if (!options?.fromAd) {
                this._adParent = this._current
            }
            this._queue = queue
            const newTrack =
                current == null
                    ? null
                    : this.getOrCreateTrack(current.uri, current)
            this.dispatch('currentTrackChanging', {
                previous: previousTrack,
                current: newTrack,
            })
            if (interrupted()) return
            this._currentTrack = newTrack
            if (previousTrack) {
                if (!options?.fromAd) {
                    adController.setAds(null)
                }
                previousTrack.deactivate()
            }
            if (newTrack) {
                const { add, dispose } = createDisposer()
                this.activeTrackSub = dispose

                // Re-baseline after the setAds(null) above: clearing the outgoing
                // track's ads nulls the active ad, which the top-level interrupted()
                // would otherwise read as an interruption and skip activation.
                const activateInterrupted = this.getQueueInterrupted()

                // Activates and optionally plays the new track. This is not invoked until after potential preroll
                // ads have been resolved.
                const activate = () => {
                    if (newTrack.active || activateInterrupted()) return
                    newTrack.activate(current!.config ?? {})
                    if (options?.shouldPlay) {
                        playbackController.play().catch(noop)
                    }
                }

                if (!options?.fromAd) {
                    adController.clearCompletedAds()
                    add(
                        newTrack.on('error', (event) => {
                            adController.failAd(event.error)
                        })
                    )

                    const refreshAds = () => {
                        adController.setAds(newTrack.ads)
                        if (newTrack.ads && !adController.currentAdBreak) {
                            activate()
                        }
                    }
                    add(newTrack.on('adsChange', refreshAds))
                    refreshAds()
                    // Ad preloading for the current track is wired by the
                    // _preload(getPrefetched()) call below (the current track is
                    // always in the prefetch window), at a priority just below
                    // the track itself.
                } else {
                    activate()
                }
            }
        } else {
            // The current track is unchanged but the queue may have (e.g. an
            // enqueue while a track is playing, or an enqueue into an empty
            // controller). Keep the queue in sync so hasNext()/next() work.
            this._queue = queue
        }
        this._preload(this.getPrefetched())
        logDebug(
            this,
            `currentTrackChange, previous: ${previous?.uri} current: ${current?.uri}`
        )
        if (previousQueue !== this._queue) {
            // Re-baseline the interruption check here: setQueue may itself have
            // changed the active ad (e.g. a content change clears it via
            // adController.setAds(null)). Only a queueChange *handler* that
            // re-enters and mutates the queue/ad should count as illegal.
            const queueChangeInterrupted = this.getQueueInterrupted()
            this.dispatch('queueChange', {
                previous: previousQueue,
                current: this._queue,
            })
            if (queueChangeInterrupted())
                throw new IllegalStateError(
                    `cannot change the queue on a 'queueChange' event`
                )
        }
        if (previousTrack !== this._currentTrack) {
            this.dispatch('currentTrackChange', {
                previous: previousTrack,
                current: this._currentTrack,
            })
        }
    }

    /**
     * Returns a callback that returns true if the queue or current ad has changed or the controller disposed.
     */
    private getQueueInterrupted(): () => boolean {
        const { adController } = this.deps
        const ad = adController.currentAd
        const idx = this.queueIdx
        return () =>
            this.disposed ||
            this.queueIdx !== idx ||
            ad !== adController.currentAd
    }

    get currentTrack(): ReadonlyTrack | null {
        return this._currentTrack
    }

    reset(hard = false) {
        this._currentTrack?.reset(hard)
    }

    get disposed(): boolean {
        return this.disposer.disposed
    }

    dispose() {
        logDebug(this, 'dispose')
        super.dispose()
        this.clearTrackCache()
        this.disposer.dispose()
    }
}
