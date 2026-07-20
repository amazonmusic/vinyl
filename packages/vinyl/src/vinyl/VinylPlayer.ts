/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Client } from '../client/Client'
import {
    type AnyRecord,
    createDisposer,
    type Disposable,
    emptyRanges,
    equalDeep,
    EventHostImpl,
    logDebug,
    logInfo,
    type ReadonlyRanges,
    type ReadonlySet,
    redispatchEvents,
    type Unsubscribe,
} from '@amazon/vinyl-util'
import {
    createContainer,
    type Factories,
    type ValidFactoryOverrides,
} from '@amazon/vinyl-di'
import { playerRegistryRef } from '../global/PlayerRegistry'
import type { PlaybackController } from '../playback/PlaybackController'
import {
    ALL_PLAYBACK_STATE_EVENTS,
    type PlaybackControllerEventMap,
    type PlaybackNetworkState,
    type PlaybackReadyState,
} from '../playback/ReadonlyPlaybackController'
import type { VinylTrackLoadOptions } from '../track/createVinylTrackFactories'
import { type ReadonlyTrack, type TrackUri } from '../track/Track'
import {
    ALL_TRACK_CONTROLLER_EVENTS,
    type TrackController,
    type TrackControllerEventMap,
} from '../track/TrackController'
import type {
    InferLoadOptionsFromFactory,
    TrackLoadOptions,
} from '../track/TrackFactory'
import type {
    DefaultVinylFactories,
    InferVinylOverrideDependencyType,
    VinylDependencyOptions,
} from './createVinylFactories'
import { createVinylFactories } from './createVinylFactories'
import type { VinylDeps } from './VinylDeps'
import type { Capabilities } from '../client/Capabilities'
import { initializeVinylGlobal } from '../global/initializeVinylGlobal'
import {
    ALL_CONTENT_TYPES,
    type ContentType,
    type MediaQualityMetadata,
} from '../streaming/MediaQualityMetadata'
import type { ReadonlyPlaybackStreamingState } from './ReadonlyPlaybackStreamingState'
import type { DrmController } from '../drm/DrmController'
import {
    ALL_STREAMING_EVENTS,
    type StreamingEventMap,
} from '../streaming/StreamingEventMap'
import type {
    InferObservableValueType,
    MutableValue,
} from '@amazon/vinyl-observable'
import type { VinylOptions } from './VinylOptions'
import type { AutoResetController } from '../track/AutoResetController'
import type { ChangeEvent } from '../event/ChangeEvent'
import type { TextTrackEventMap, TextTrackInfo } from '../text/TextTrack'
import type { AdBreakInfo, AdEventMap } from '../ad/AdBreak'

/**
 * Events the Vinyl Player emits.
 */
export interface VinylPlayerEventMap<
    TrackLoadOptionsType extends TrackLoadOptions = VinylTrackLoadOptions,
>
    extends
        PlaybackControllerEventMap,
        TrackControllerEventMap<TrackLoadOptionsType>,
        StreamingEventMap,
        TextTrackEventMap,
        AdEventMap {
    /**
     * Dispatched when {@link VinylPlayer.resetPending} changes.
     *
     * `current` is true when the player has hit a transient, potentially
     * recoverable error (e.g. a network outage) and an automatic reset
     * attempt is scheduled. `current` is false once the pending reset is
     * emitted, the error is cleared, or all retries are exhausted.
     *
     * If `resetPending` becomes false while {@link VinylPlayer.error} is
     * still non-null, all automatic reset attempts have been exhausted
     * and playback will not recover without user action.
     */
    readonly resetPendingChange: ChangeEvent<boolean>
}

const ALL_TEXT_TRACK_EVENTS = [
    'textTracksChange',
    'activeTextTrackChange',
    'textTrackError',
] as const satisfies readonly (keyof TextTrackEventMap)[]

const ALL_AD_EVENTS = [
    'adBreaksChange',
    'adBreakEnter',
    'adBreakExit',
] as const satisfies readonly (keyof AdEventMap)[]

/**
 * A Vinyl Media Player.
 *
 * Unless custom dependencies need to be provided, use {@link createVinylPlayer} to construct
 * a new player implementation.
 */
export class VinylPlayer<
    TrackLoadOptionsType extends TrackLoadOptions = VinylTrackLoadOptions,
    OptionsType = VinylOptions,
>
    extends EventHostImpl<VinylPlayerEventMap<TrackLoadOptionsType>>
    implements
        PlaybackController,
        TrackController<TrackLoadOptionsType>,
        ReadonlyPlaybackStreamingState,
        Disposable
{
    get [Symbol.toStringTag](): string {
        return 'VinylPlayer'
    }

    protected readonly deps: VinylDeps<TrackLoadOptionsType, OptionsType>

    private get drmController(): DrmController {
        return this.deps.drmController
    }

    private get playbackController(): PlaybackController {
        return this.deps.playbackController
    }

    private get trackController(): TrackController<TrackLoadOptionsType> {
        return this.deps.trackController
    }

    private get autoResetController(): AutoResetController {
        return this.deps.autoResetController
    }

    /**
     * Provides information about the client, such as device and browser capabilities.
     */
    readonly client: Client

    private _error: Error | null = null

    protected readonly disposer = createDisposer()

    /**
     * Constructs a new VinylPlayer with the given dependency factories.
     * This constructor is protected, use {@link createVinylPlayer} to construct a new player.
     *
     * @param factories
     * @see createVinylPlayer
     */
    protected constructor(
        factories: Factories<VinylDeps<TrackLoadOptionsType, OptionsType>>
    ) {
        initializeVinylGlobal()
        super()
        const add = this.disposer.add
        this.deps = add(createContainer(factories)).dependencies

        this.client = {
            capabilities: this.deps.capabilities,
        }
        playerRegistryRef.value.addPlayer(this)
        this.redispatchSubControllerEvents()
        this.redispatchCurrentTrackEvents()
        this.initializeAutoResetHandling()
        this.initializePreferredLanguageHandling()
    }

    protected redispatchSubControllerEvents(): void {
        const add = this.disposer.add
        add(
            redispatchEvents(
                this,
                this.playbackController,
                ALL_PLAYBACK_STATE_EVENTS.filter(notResetEvent)
            )
        )
        add(
            redispatchEvents(
                this,
                this.trackController,
                ALL_TRACK_CONTROLLER_EVENTS
            )
        )
        add(redispatchEvents(this, this.drmController, ['error']))

        this.on('error', (event) => {
            this._error = event.error
        })
    }

    /**
     * Certain track events are redispatched on the player for the current track.
     */
    protected redispatchCurrentTrackEvents() {
        let sub: Unsubscribe | null = null
        let textSub: Unsubscribe | null = null
        let adSub: Unsubscribe | null = null
        const add = this.disposer.add
        add(
            this.trackController.on('currentTrackChange', (event) => {
                // The previous track may stay cached, so its text track
                // controller isn't disposed here. Deactivate its selection
                // so the DOM TextTrack is disabled and cues cleared. Done
                // before tearing down redispatch subs so the resulting
                // activeTextTrackChange event flows through to the player.
                const prevTextController = event.previous
                    ?.textTrackController as
                    | { setActiveTextTrack(id: string | null): void }
                    | null
                    | undefined
                prevTextController?.setActiveTextTrack(null)
                sub?.()
                sub = null
                textSub?.()
                textSub = null
                adSub?.()
                adSub = null
                if (event.current) {
                    sub = redispatchEvents(
                        this,
                        event.current,
                        ALL_STREAMING_EVENTS.filter(notResetEvent)
                    )
                    if (event.current.textTrackController) {
                        textSub = redispatchEvents(
                            this,
                            event.current.textTrackController,
                            ALL_TEXT_TRACK_EVENTS
                        )
                    }
                    if (event.current.adController) {
                        adSub = redispatchEvents(
                            this,
                            event.current.adController,
                            ALL_AD_EVENTS
                        )
                    }
                }
                this.emitTextTrackChangeEventsFor(event.previous, event.current)
                this.emitAdBreaksChangeEventsFor(event.previous, event.current)
                this.dispatch('fetchedRangesChange', {})

                // Emit a quality change event for every stream that has changed
                // for streaming, buffering, and playback
                for (const contentType of ALL_CONTENT_TYPES) {
                    for (const [
                        eventType,
                        getterName,
                    ] of qualityEventsAndGetters) {
                        const previous =
                            event.previous?.[getterName](contentType) ?? null
                        const current =
                            event.current?.[getterName](contentType) ?? null
                        if (previous !== current) {
                            this.dispatch(eventType, {
                                previous,
                                current,
                            })
                        }
                    }
                }

                // Emit qualities change events on track switch
                const prevQualities = event.previous?.qualities ?? null
                const curQualities = event.current?.qualities ?? null
                if (prevQualities !== curQualities && curQualities) {
                    this.dispatch('qualitiesChange', {
                        previous: prevQualities ?? [],
                        current: curQualities,
                    })
                }
                const prevUnfiltered =
                    event.previous?.qualitiesUnfiltered ?? null
                const curUnfiltered = event.current?.qualitiesUnfiltered ?? null
                if (prevUnfiltered !== curUnfiltered && curUnfiltered) {
                    this.dispatch('qualitiesUnfilteredChange', {
                        previous: prevUnfiltered ?? [],
                        current: curUnfiltered,
                    })
                }
            })
        )
    }

    private initializeAutoResetHandling() {
        // Initializes the binding between the player and the reset handler.
        // On an error, notify the auto reset controller which will
        // monitor network changes and periodically request a reset.
        const { add } = this.disposer
        this.on('error', (event) => {
            this.autoResetController.setError(event.error)
        })
        add(this.autoResetController.on('reset', () => this.reset()))
        add(
            this.autoResetController.on('resetPendingChange', (event) =>
                this.dispatch('resetPendingChange', event)
            )
        )
    }

    private initializePreferredLanguageHandling() {
        const { add } = this.disposer
        // When the preferred language changes, clear the prefetch to immediately switch.
        add(
            (this.deps.options as MutableValue<VinylOptions>)
                .pick('preferredAudioLanguage')
                .onData((_value, previous) => {
                    if (previous !== undefined) this.clearPrefetch()
                })
        )
    }

    /**
     * Returns the current player options.
     * Use `configure` to set.
     */
    get options(): OptionsType {
        return this.deps.options.value
    }

    /**
     * Sets options on this player.
     * Options will be merged shallowly, for example,
     * `configure({ abr: { strategy: AbrStrategy.BEST }})` will replace all previous `abr` options, and not
     * change other options such as `loudnessNormalization`.
     *
     * @param options
     */
    configure(options: Partial<OptionsType>): void {
        logDebug(this, 'configure', options)
        const newValue = { ...this.options, ...options }
        if (!equalDeep(newValue, this.options)) {
            this.deps.options.value = newValue
        }
    }

    get capabilities(): Capabilities {
        return this.deps.capabilities
    }

    //----------------------------------------------------
    // PlaybackController delegate methods
    //----------------------------------------------------

    get buffered(): ReadonlyRanges {
        return this.playbackController.buffered
    }

    get canPlay(): boolean {
        return this.playbackController.canPlay
    }

    get canPlayThrough(): boolean {
        return this.playbackController.canPlayThrough
    }

    get currentTime(): number {
        return this.playbackController.currentTime
    }

    get currentTimePercent(): number {
        return this.playbackController.currentTimePercent
    }

    get defaultPlaybackRate(): number {
        return this.playbackController.defaultPlaybackRate
    }

    set defaultPlaybackRate(value: number) {
        this.playbackController.defaultPlaybackRate = value
    }

    get duration(): number {
        return this.playbackController.duration
    }

    get ended(): boolean {
        return this.playbackController.ended
    }

    /**
     * The last error reported.
     */
    get error(): Error | null {
        return this._error
    }

    /**
     * True when an error has interrupted playback and an automatic reset
     * is scheduled. This distinguishes transient, potentially recoverable
     * errors (such as a brief network outage) from terminal errors that
     * will not trigger a reset on their own.
     *
     * Listen to `resetPendingChange` events for changes.
     */
    get resetPending(): boolean {
        return this.autoResetController.resetPending
    }

    get hasMetadata(): boolean {
        return this.playbackController.hasMetadata
    }

    get loop(): boolean {
        return this.playbackController.loop
    }

    set loop(value: boolean) {
        this.playbackController.loop = value
    }

    get muted(): boolean {
        return this.playbackController.muted
    }

    set muted(value: boolean) {
        this.playbackController.muted = value
    }

    get networkState(): PlaybackNetworkState {
        return this.playbackController.networkState
    }

    get paused(): boolean {
        return this.playbackController.paused
    }

    get playbackRate(): number {
        return this.playbackController.playbackRate
    }

    set playbackRate(value: number) {
        this.playbackController.playbackRate = value
    }

    get playIsPending(): boolean {
        return this.playbackController.playIsPending
    }

    get playing(): boolean {
        return this.playbackController.playing
    }

    get preservesPitch(): boolean {
        return this.playbackController.preservesPitch
    }

    set preservesPitch(value: boolean) {
        this.playbackController.preservesPitch = value
    }

    get readyState(): PlaybackReadyState {
        return this.playbackController.readyState
    }

    get seekable(): ReadonlyRanges {
        return this.playbackController.seekable
    }

    get seeking(): boolean {
        return this.playbackController.seeking
    }

    get volume(): number {
        return this.playbackController.volume
    }

    set volume(value: number) {
        this.playbackController.volume = value
    }

    get waiting(): boolean {
        return this.playbackController.waiting
    }

    pause(): void {
        this.playbackController.pause()
    }

    play(): Promise<void> {
        return this.playbackController.play()
    }

    seekTo(time: number, tolerance?: number): Promise<void> {
        return this.playbackController.seekTo(time, tolerance)
    }

    reset() {
        if (!this._error) {
            logDebug(this, 'reset no-op')
            return
        }
        logDebug(this, 'reset')
        this._error = null
        this.drmController.reset()
        this.playbackController.reset()
        this.trackController.reset()
        this.autoResetController.clear()
        this.dispatch('reset', {})
    }

    //----------------------------------------------------
    // TrackController delegate methods
    //----------------------------------------------------

    get currentTrack(): ReadonlyTrack | null {
        return this.trackController.currentTrack
    }

    get queue(): readonly TrackLoadOptionsType[] {
        return this.trackController.queue
    }

    preload(...loadOptionsList: TrackLoadOptionsType[]): void {
        this.trackController.preload(...loadOptionsList)
    }

    load(...loadOptionsList: TrackLoadOptionsType[]): void {
        this.trackController.load(...loadOptionsList)
    }

    enqueue(...loadOptionsList: TrackLoadOptionsType[]): void {
        this.trackController.enqueue(...loadOptionsList)
    }

    unload(): void {
        this.trackController.unload()
    }

    hasNext(): boolean {
        return this.trackController.hasNext()
    }

    next(): void {
        return this.trackController.next()
    }

    isTrackCached(uri: TrackUri): boolean {
        return this.trackController.isTrackCached(uri)
    }

    getCachedTrack(uri: TrackUri): ReadonlyTrack | null {
        return this.trackController.getCachedTrack(uri)
    }

    getCachedTracks(): IterableIterator<ReadonlyTrack> {
        return this.trackController.getCachedTracks()
    }

    clearPrefetch(): void {
        this.trackController.clearPrefetch()
    }

    clearTrackCache(): void {
        this.trackController.clearTrackCache()
    }

    clearQueue(): void {
        this.trackController.clearQueue()
    }

    //----------------------------------------------------
    // CurrentTrackStreamingState methods
    //----------------------------------------------------

    /**
     * Returns the fetched ranges of the current track.
     * If there is no current track, empty ranges will be returned.
     *
     * Listen to {@link VinylPlayerEventMap.fetchedRangesChange} for changes.
     */
    get fetchedRanges(): ReadonlyRanges {
        return this.currentTrack?.fetchedRanges ?? emptyRanges
    }

    /**
     * Returns the time of the prefetch end.
     * If no data has been prefetched for the current track, 0 will be returned.
     *
     * The time given will be in seconds according to the media timeline.
     * It will represent the ending time of the continuous prefetch range from the current playhead time.
     */
    get fetchedTime(): number {
        const time = this.playbackController.currentTime
        const range = this.fetchedRanges.getRangeAt(time)
        if (!range) return 0
        return range[1]
    }

    /**
     * Returns current fetched time as a percent of the total duration.
     *
     * @return A number between 0-1
     */
    get fetchedTimePercent(): number {
        return this.duration > 0 ? this.fetchedTime / this.duration : 0
    }

    /**
     * Returns the current content types for active streams.
     */
    get contentTypes(): ReadonlySet<ContentType> {
        return this.currentTrack?.contentTypes ?? emptyContentTypes
    }

    /**
     * The available qualities for the current period of the current track, after filtering.
     * Null if no track is active or the timeline is not yet available.
     */
    get qualities(): readonly MediaQualityMetadata[] | null {
        return this.currentTrack?.qualities ?? null
    }

    /**
     * The available unfiltered qualities for the current period of the current track.
     * Null if no track is active or the timeline is not yet available.
     */
    get qualitiesUnfiltered(): readonly MediaQualityMetadata[] | null {
        return this.currentTrack?.qualitiesUnfiltered ?? null
    }

    /**
     * @deprecated Use `getStreamingQuality('audio')`
     */
    get streamingQuality(): MediaQualityMetadata | null {
        return this.getStreamingQuality('audio')
    }

    /**
     * @deprecated Use `getBufferingQuality('audio')
     */
    get bufferingQuality(): MediaQualityMetadata | null {
        return this.getStreamingQuality('audio')
    }

    /**
     * @deprecated Use `getPlaybackQuality('audio')
     */
    get playbackQuality(): MediaQualityMetadata | null {
        return this.getPlaybackQuality('audio')
    }

    /**
     * The streaming quality for the current track.
     * Note that this does not represent the quality of inactive preloading tracks.
     */
    getStreamingQuality(contentType: ContentType): MediaQualityMetadata | null {
        return this.currentTrack?.getStreamingQuality(contentType) ?? null
    }

    /**
     * The currently buffering quality, or null if no data is buffered.
     */
    getBufferingQuality(contentType: ContentType): MediaQualityMetadata | null {
        return this.currentTrack?.getBufferingQuality(contentType) ?? null
    }

    /**
     * The currently playing quality, or null if no media is playing.
     */
    getPlaybackQuality(contentType: ContentType): MediaQualityMetadata | null {
        return this.currentTrack?.getPlaybackQuality(contentType) ?? null
    }

    //----------------------------------------------------
    // Text track delegate methods
    //----------------------------------------------------

    /**
     * The list of currently discovered sidecar text tracks for the active
     * media. Empty when there is no current track or the current track
     * carries no text.
     */
    get textTracks(): readonly TextTrackInfo[] {
        return this.currentTrack?.textTrackController?.textTracks ?? []
    }

    /**
     * The currently active text track, or null if no track is selected.
     */
    get activeTextTrack(): TextTrackInfo | null {
        return this.currentTrack?.textTrackController?.activeTextTrack ?? null
    }

    /**
     * Selects the text track with the given id, or clears the active text
     * track when called with null. No-op when the current track does not
     * surface text tracks or the id is unknown.
     */
    setActiveTextTrack(id: string | null): void {
        const controller = this.deps.trackController.currentTrack
            ?.textTrackController as
            | { setActiveTextTrack(id: string | null): void }
            | null
            | undefined
        controller?.setActiveTextTrack(id)
    }

    private emitTextTrackChangeEventsFor(
        previous: ReadonlyTrack | null,
        current: ReadonlyTrack | null
    ): void {
        // Active-track changes are surfaced by redispatching the previous
        // track's controller (deactivated on switch) and the current track's
        // controller. Here we only bridge the list-of-tracks difference,
        // which doesn't have its own redispatched signal at track boundaries.
        const prevList =
            previous?.textTrackController?.textTracks ??
            ([] as readonly TextTrackInfo[])
        const curList =
            current?.textTrackController?.textTracks ??
            ([] as readonly TextTrackInfo[])
        if (prevList !== curList) {
            this.dispatch('textTracksChange', {
                previous: prevList,
                current: curList,
            })
        }
    }

    //----------------------------------------------------
    // Ad break delegate methods
    //----------------------------------------------------

    /**
     * The ad breaks (e.g. HLS Interstitials) discovered for the active media,
     * ordered by start time. Empty when there is no current track or the
     * current track surfaces no ads.
     *
     * Listen to {@link AdEventMap.adBreaksChange} for changes.
     */
    get adBreaks(): readonly AdBreakInfo[] {
        return this.currentTrack?.adController?.adBreaks ?? []
    }

    /**
     * The ad break currently containing the playhead, or null when the
     * playhead is in primary content.
     *
     * Listen to {@link AdEventMap.adBreakEnter} and
     * {@link AdEventMap.adBreakExit} for transitions.
     */
    get activeAdBreak(): AdBreakInfo | null {
        return this.currentTrack?.adController?.activeAdBreak ?? null
    }

    private emitAdBreaksChangeEventsFor(
        previous: ReadonlyTrack | null,
        current: ReadonlyTrack | null
    ): void {
        // Bridge the ad-break list difference at track boundaries, mirroring
        // how text-track lists are surfaced on switch.
        const prevList =
            previous?.adController?.adBreaks ?? ([] as readonly AdBreakInfo[])
        const curList =
            current?.adController?.adBreaks ?? ([] as readonly AdBreakInfo[])
        if (prevList !== curList) {
            this.dispatch('adBreaksChange', {
                previous: prevList,
                current: curList,
            })
        }
    }

    //----------------------------------------------------

    /**
     * Returns true if this player has been disposed.
     */
    get disposed(): boolean {
        return this.disposer.disposed
    }

    /**
     * Disposes this player and sub-systems.
     */
    dispose(): void {
        logDebug(this, 'dispose')
        super.dispose()
        this.disposer.dispose()
        playerRegistryRef.value.removePlayer(this)
    }
}

/**
 * Constructs a new {@link VinylPlayer}.
 *
 * @param options Configuration for default dependencies.
 * @param factoryOverrides Dependency factory overrides.
 */
export function createVinylPlayer<
    DependencyOverridesType extends Factories | undefined,
>(
    options: VinylDependencyOptions,
    factoryOverrides?: ValidFactoryOverrides<
        VinylDeps<any, AnyRecord>,
        DefaultVinylFactories,
        DependencyOverridesType
    >
): VinylPlayer<
    // The player will accept the load options for the track factories, accounting for overrides.
    InferLoadOptionsFromFactory<
        InferVinylOverrideDependencyType<
            NoInfer<DependencyOverridesType>,
            'trackFactory'
        >
    >,
    // Infer the options type.
    InferObservableValueType<
        InferVinylOverrideDependencyType<
            NoInfer<DependencyOverridesType>,
            'options'
        >
    >
> {
    const player = new (VinylPlayer as any)({
        ...createVinylFactories(options),
        ...factoryOverrides,
    })
    logInfo(player, `VinylPlayer initialized`)
    return player
}

/**
 * Do not redispatch reset events, only emit the reset event when `player.reset` is called.
 * @param type
 */
function notResetEvent<T extends string>(type: T): type is Exclude<T, 'reset'> {
    return type !== 'reset'
}

const qualityEventsAndGetters = [
    ['streamingQualityChange', 'getStreamingQuality'],
    ['bufferingQualityChange', 'getBufferingQuality'],
    ['playbackQualityChange', 'getPlaybackQuality'],
] as const

const emptyContentTypes = new Set<ContentType>()
