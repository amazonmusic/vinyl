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
    logError,
    logInfo,
    logVerbose,
    logWarn,
    LruCache,
    type Maybe,
    noop,
    type ReadonlyEventHost,
    resolveValueProvider,
    type Unsubscribe,
} from '@amazon/vinyl-util'
import type { PlaybackController } from '../playback/PlaybackController'
import type { ReadonlyTrack, Track, TrackUri } from './Track'
import type {
    TrackConfigOptions,
    TrackFactory,
    TrackLoadOptions,
} from './TrackFactory'
import type { ChangeEvent } from '../event/ChangeEvent'
import type { AdController } from '../ad/AdController'
import type { AdBreakInfo, AdInfo } from '../ad/AdBreakInfo'

export interface TrackControllerEventMap<
    TrackLoadOptionsType extends TrackLoadOptions,
> {
    /**
     * A track became active. For content this may be deferred behind a preroll;
     * for an ad it fires as the ad activates. {@link queueChange} precedes it.
     */
    readonly trackActivated: TrackLifecycleEvent

    /**
     * A previously-active track was torn down (superseded or unloaded).
     */
    readonly trackDeactivated: TrackLifecycleEvent

    /**
     * Dispatched when the queue has changed.
     *
     * Will be emitted before {@link trackActivated}.
     */
    readonly queueChange: ChangeEvent<readonly TrackLoadOptionsType[]>

    /**
     * Emitted when the current track — including any postroll ads — has finished
     * playing. Fires once per track: as the queue advances it precedes the
     * resulting {@link trackActivated}, and for the final track it precedes
     * `queueEnded`. Distinct from the media element's `ended` (which also fires
     * for each ad) and from an individual ad's `adEnded`, so applications can act
     * on true track completion (e.g. logging a play) without confusing it with
     * an ad ending or the content ending before its postroll plays.
     */
    readonly trackEnded: TrackEndedEvent

    /**
     * Emitted when the last track of the playback queue (and any of its
     * postroll ads) have ended.
     */
    readonly queueEnded: AnyRecord
}

export const ALL_TRACK_CONTROLLER_EVENTS = [
    'trackActivated',
    'trackDeactivated',
    'queueChange',
    'trackEnded',
    'queueEnded',
] as const satisfies readonly (keyof TrackControllerEventMap<any>)[]

/** Payload for {@link trackActivated} / {@link trackDeactivated}. */
export interface TrackLifecycleEvent {
    readonly track: ReadonlyTrack
}

/**
 * Payload for the {@link TrackControllerEventMap.trackEnded} event: the load
 * options of the track that finished playing (including any postroll ads).
 */
export interface TrackEndedEvent {
    readonly track: TrackLoadOptions
}

/**
 * A readonly interface to the track controller.
 */
export interface ReadonlyTrackController<
    TrackLoadOptionsType extends TrackLoadOptions,
> extends ReadonlyEventHost<TrackControllerEventMap<TrackLoadOptionsType>> {
    /**
     * The active track, or null when the selected track has not yet activated
     * (e.g. behind a preroll) or nothing is loaded.
     */
    readonly activeTrack: ReadonlyTrack | null

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
    // The primary content track cache. Bounded by preloadCapacity + prefetch.
    private readonly trackCache = new LruCache<string, Track>(0)
    // A monotonically increasing id for a queue change, to allow for queue changes during events.
    private queueIdx = 0
    private _queue: readonly TrackLoadOptionsType[] = []
    // The current content track data in the queue. This will never represent an ad.
    private _current: TrackLoadOptionsType | null = null
    // The current Track, may be a content track or an ad track.
    private _currentTrack: Track | null = null
    // The parent content track. Used as a reference to the track that initiated an ad break.
    private adParent: Track | null = null

    // Current-track subscriptions (e.g. `error` → adController.failAd),
    // re-bound per setCurrentTrack. Promote to a disposer if more are added.
    private currentTrackSub: Unsubscribe | null = null

    // Ad tracks keyed by parent content URI, kept out of the content cache.
    // Pegged to the parent: disposed when the parent is evicted (see onEvict).
    private readonly adTracksByParent = new Map<
        TrackUri,
        Map<TrackUri, Track>
    >()

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
            // Ad tracks are pegged to their parent — disposing them here keeps
            // them from outliving the content track they belong to.
            this.disposeAdTracksFor(track.uri)
            track.dispose()
            return true
        }

        add(playbackController.on('ended', this.onEnded))

        this.initializeAdHandling()
        this.configure(initialOptions)
    }

    private initializeAdHandling() {
        const { add } = this.disposer
        const { adController, adTrackLoadOptionsProvider, playbackController } =
            this.deps
        add(
            adController.on('adPreload', (event) => {
                // The playhead is approaching a midroll/postroll break; warm its
                // ad tracks for the current content track so they are ready on
                // entry. Prerolls are already warmed by preloadPrerollAds.
                const adParent = this.adParent
                if (adParent) this.preloadBreakAds(adParent, event.adBreak)
            })
        )
        add(
            adController.on('adEntered', (event) => {
                const adParent = this.adParent
                if (!adParent) {
                    logDebug(this, 'ad entered, no parent track')
                    return
                }
                const interrupted = () =>
                    this.adParent !== adParent ||
                    adController.currentAd !== event.ad
                if (event.ad.uri) {
                    // Infer the track load options from the ad.
                    adTrackLoadOptionsProvider(event.ad)
                        .then((adTrack) => {
                            if (!interrupted()) {
                                // set adTrack
                                this.setCurrentTrack(
                                    this.getOrCreateAdTrack(
                                        adParent.uri,
                                        adTrack
                                    ),
                                    {
                                        isAd: true,
                                        checkPreroll: false,
                                        config: {},
                                    }
                                )
                                playbackController.play().catch(noop)
                            }
                        })
                        .catch((error) => {
                            if (!interrupted()) adController.failAd(error)
                        })
                }
            })
        )

        add(
            adController.on('adBreakCompleted', (event) => {
                logDebug(this, 'adBreakCompleted')
                const adParent = this.adParent
                if (!adParent) {
                    logDebug(this, 'ad break completed, no parent track')
                    return
                }
                if (adController.currentAdBreak) {
                    logDebug(this, 'more adbreaks')
                    return
                }
                if (adParent.active) {
                    logDebug(this, 'no ads began')
                    return
                }
                const adParentLoad = this._current!
                const placement = event.adBreak.placement
                const isPreroll = placement === 'preroll'
                const isPostroll = placement === 'postroll'

                // A completed postroll marks the end of the whole track
                // (content + postroll); preroll/midroll only resume content.
                if (isPostroll) {
                    logDebug(this, 'trackEnded after postroll')
                    this.dispatch('trackEnded', { track: adParentLoad })
                }
                if (isPostroll && this.hasNext()) {
                    this.next()
                } else {
                    // Overrides the config startTime to resume from the correct position.
                    const startTime = isPreroll
                        ? adParentLoad.config?.startTime
                        : event.resumePosition
                    // Resume the main track.
                    this.setCurrentTrack(adParent, {
                        config: {
                            ...adParentLoad.config,
                            startTime,
                        },
                        isAd: false,
                        checkPreroll: false,
                    })
                    if (isPostroll) {
                        logInfo(this, 'queueEnded after postroll ad(s)')
                        this.dispatch('queueEnded', {})
                    } else {
                        playbackController.play().catch(noop)
                    }
                }
            })
        )
    }

    /**
     * The current track has ended naturally. On the next tick advance the queue or emit queue ended.
     */
    private onEnded = () => {
        const { adController } = this.deps

        // `ended` fires for ad tracks too (they share the media element); an
        // ad's end is the AdController's concern, the queue or content may be resumed on 'adBreakCompleted'
        if (this.currentTrackIsAdTrack) return
        const track = this._current
        if (!track) {
            logWarn(this, 'an ended event was received with no current track')
            return
        }
        const interrupted = this.getQueueInterrupted()
        adController
            .enterPostroll()
            .then((postroll) => {
                if (postroll) {
                    // There is a pending postroll, do not advance the queue,
                    // a new adEntered event will fire.
                    logDebug(this, 'postroll entered')
                } else {
                    // The content ended with no postroll: the track is done.
                    logDebug(this, 'trackEnded')
                    this.dispatch('trackEnded', { track })
                    // Adds a microtask delay to allow applications an opportunity to respond to 'ended' and 'trackEnded'
                    // events before the queue is advanced.
                    queueMicrotask(() => {
                        if (interrupted()) return
                        if (this.hasNext()) {
                            this.next()
                        } else {
                            logInfo(this, 'queueEnded')
                            this.dispatch('queueEnded', {})
                        }
                    })
                }
            })
            .catch((error) => {
                logError(this, 'enterPostroll failed', error)
            })
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
            const track = this.getOrCreateTrack(loadOptions)
            const prefetchPriority = priority--
            logVerbose(
                this,
                `preloading track ${track.uri} with priority ${prefetchPriority}`
            )
            track.preload(
                {
                    prefetchPriority,
                },
                loadOptions.config ?? {}
            )
            this.preloadPrerollAds(track, prefetchPriority)
        }
    }

    private preloadPrerollAds(
        parentTrack: ReadonlyTrack,
        parentTrackPriority: number
    ): void {
        parentTrack
            .getAds()
            .then(async (trackAds) => {
                for (const [index, adBreak] of trackAds.adBreaks.entries()) {
                    if (adBreak.placement !== 'preroll') continue
                    const ads = await resolveValueProvider(adBreak.ads)
                    for (const ad of ads) {
                        await this.preloadAd({
                            parentTrack,
                            // A prefetch priority fractionally higher than the
                            // parent track (so a preroll is warmed before its
                            // content), later breaks slightly higher than earlier.
                            prefetchPriority:
                                parentTrackPriority + (index + 1) / 1000,
                            ad,
                        })
                    }
                }
            })
            .catch((error) => {
                // Preloading prerolls is best-effort: an ad-discovery, ad-list,
                // or ad-options failure must not surface as an unhandled
                // rejection (it just means the preroll isn't warmed up).
                logVerbose(
                    this,
                    `preroll ad preload failed for ${parentTrack.uri}`,
                    error
                )
            })
    }

    /**
     * Warms the ad tracks for an approaching midroll/postroll break (driven by
     * the ad controller's `adPreload`). Best-effort: an ad-list or ad-options
     * failure is logged, not thrown. The break is imminent, so its ad tracks
     * get a prefetch priority above the current content prefetch window.
     */
    private preloadBreakAds(
        parentTrack: ReadonlyTrack,
        adBreak: AdBreakInfo
    ): void {
        trackPriority.value += 1
        const prefetchPriority = trackPriority.value
        resolveValueProvider(adBreak.ads)
            .then(async (ads) => {
                for (const ad of ads) {
                    await this.preloadAd({ parentTrack, prefetchPriority, ad })
                }
            })
            .catch((error) => {
                logVerbose(
                    this,
                    `ad preload failed for break ${adBreak.id}`,
                    error
                )
            })
    }

    /** Preloads an ad for a parent track. Aborts if the parent track is disposed before the ad load options resolve. **/
    private async preloadAd({
        parentTrack,
        prefetchPriority,
        ad,
    }: {
        readonly parentTrack: ReadonlyTrack
        readonly prefetchPriority: number
        readonly ad: AdInfo
    }) {
        const { adTrackLoadOptionsProvider } = this.deps
        const loadOptions = await adTrackLoadOptionsProvider(ad)
        if (parentTrack.disposed) return
        logVerbose(
            this,
            `preloading ad id=${ad.id} uri=${ad.uri} priority=${prefetchPriority}`
        )
        const adTrack = this.getOrCreateAdTrack(parentTrack.uri, loadOptions)
        adTrack.preload(
            {
                prefetchPriority,
            },
            loadOptions.config ?? {}
        )
    }

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
        if (this._currentTrack == null && this.hasNext()) this.next()
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
            this.disposeAdTracksFor(track.uri)
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
     * @param loadOptions
     * @private
     */
    private getOrCreateTrack(loadOptions: TrackLoadOptionsType): Track {
        return getOrSet(this.trackCache, loadOptions.uri, () =>
            this.deps.trackFactory.createTrack(loadOptions)
        )
    }

    /**
     * Gets the cached ad track, or creates a new one and sets it in the
     * parent track mapping.
     * When the parent track is disposed, this ad track will be as well.
     *
     * @param parentUri The URI of the parent track.
     * @param loadOptions
     * @private
     */
    private getOrCreateAdTrack(
        parentUri: TrackUri,
        loadOptions: TrackLoadOptionsType
    ): Track {
        const parentTracks = getOrSet(
            this.adTracksByParent,
            parentUri,
            () => new Map()
        )
        return getOrSet(parentTracks, loadOptions.uri, () =>
            this.deps.trackFactory.createTrack(loadOptions)
        )
    }

    /**
     * Sets the current track and following queue.
     *
     * If the given track is already current, it will be de-activated and re-activated and the
     * trackDeactivated/trackActivated events will still be emitted. The same track may be in the
     * queue multiple times.
     */
    private setQueue(
        current: Maybe<TrackLoadOptionsType>,
        queue: readonly TrackLoadOptionsType[],
        options?: {
            /**
             * If true, starts playback after the track has changed.
             */
            readonly shouldPlay?: boolean
        }
    ): void {
        const { playbackController } = this.deps
        ++this.queueIdx
        const interrupted = this.getQueueInterrupted()
        const previousQueue = this._queue
        const previous = this._current

        if (previous !== current) {
            // Update the pointers before materializing the track, so eviction
            // protects the incoming track and its window, not the outgoing one.
            this._current = current ?? null
            this._queue = queue

            this.setCurrentTrack(
                current ? this.getOrCreateTrack(current) : null,
                {
                    isAd: false,
                    checkPreroll: true,
                    config: current?.config,
                }
            )
            if (options?.shouldPlay) {
                // playback controller defers play until the new track is loaded
                playbackController.play().catch(noop)
            }
        } else {
            // Current track unchanged but the queue may have (e.g. enqueue).
            // Keep it in sync so hasNext()/next() work.
            this._queue = queue
        }
        this._preload(this.getPrefetched())
        logDebug(
            this,
            `track change, previous: ${previous?.uri} current: ${current?.uri}`
        )
        if (previousQueue !== queue) {
            this.dispatch('queueChange', {
                previous: previousQueue,
                current: queue,
            })
        }
        if (interrupted()) {
            throw new IllegalStateError(
                `cannot change the queue on a 'queueChange' or 'trackDeactivated' event`
            )
        }
    }

    private get currentTrackIsAdTrack(): boolean {
        return this._currentTrack !== this.adParent
    }

    /**
     * Sets the active track.
     * This may either be a content track created from `setQueue` or an ad track created from `adEntered`.
     *
     * @param newTrack
     * @param options
     * @private
     */
    private setCurrentTrack(
        newTrack: Track | null,
        options: {
            config?: Maybe<TrackConfigOptions>
            isAd: boolean
            checkPreroll: boolean
        }
    ): void {
        const { adController } = this.deps
        const previousTrack = this._currentTrack
        const previousWasActive = previousTrack?.active ?? false
        this._currentTrack = newTrack
        const interrupted = () => this._currentTrack !== newTrack
        previousTrack?.deactivate()
        if (previousTrack && previousWasActive) {
            this.dispatch('trackDeactivated', { track: previousTrack })
        }

        // Forward the active track's errors to the ad controller. When an ad
        // track errors (fails to load or errors mid-playback), this fails the
        // ad so the break advances rather than stalling on the broken ad; on a
        // content track failAd is a no-op (the error still surfaces as a player
        // error). Re-subscribed per track and torn down on the next change.
        this.currentTrackSub?.()
        this.currentTrackSub =
            newTrack?.on('error', (event) =>
                adController.failAd(event.error)
            ) ?? null

        if (!options.isAd) {
            this.adParent = newTrack
            adController.setParentTrack(newTrack)
        }
        if (newTrack) {
            const activate = () => {
                if (interrupted()) return
                newTrack.activate(options.config ?? {})
                this.dispatch('trackActivated', { track: newTrack })
            }
            if (options.isAd || !options.checkPreroll) {
                activate() // Ads cannot have prerolls.
            } else {
                adController
                    .enterPreroll()
                    .then((preroll) => {
                        if (preroll) return // preroll entered
                        activate()
                    })
                    .catch((error) => {
                        logError(this, 'enterPreroll failed', error)
                        activate()
                    })
            }
        }
    }

    /**
     * Disposes all preloaded ad tracks belonging to the given parent content
     * URI and drops the parent's entry from the ad map.
     */
    private disposeAdTracksFor(parentUri: TrackUri): void {
        const adTracks = this.adTracksByParent.get(parentUri)
        if (!adTracks) return
        this.adTracksByParent.delete(parentUri)
        for (const track of adTracks.values()) track.dispose()
    }

    /**
     * Returns a callback that returns true if the queue has changed or the controller disposed.
     */
    private getQueueInterrupted(): () => boolean {
        const idx = this.queueIdx
        return () => this.disposed || this.queueIdx !== idx
    }

    get activeTrack(): ReadonlyTrack | null {
        return this._currentTrack?.active ? this._currentTrack : null
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
