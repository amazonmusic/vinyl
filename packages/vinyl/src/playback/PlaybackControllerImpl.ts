/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Abort,
    AbortError,
    Browser,
    clamp,
    closeTo,
    createDisposer,
    createTimeRangesReader,
    DomEventHost,
    ErrorLevel,
    ErrorOrigin,
    EventHostImpl,
    getUserAgentInfo,
    hasBrowser,
    logDebug,
    logInfo,
    logWarn,
    nextEventAsPromise,
    onAny,
    ownKeys,
    type ReadonlyEventHost,
    type ReadonlyRanges,
    TimeoutSlot,
    toLowerCase,
    withAbort,
    withTimeout,
} from '@amazon/vinyl-util'
import { LIVE_DURATION, type PlaybackController } from './PlaybackController'
import {
    type PlaybackControllerEventMap,
    PlaybackReadyState,
    playedReasons,
    waitedReasons,
} from './ReadonlyPlaybackController'
import { InvalidSeekError } from './error/InvalidSeekError'
import { playbackStateLoggingHandler } from './logging/playbackStateLoggingHandler'
import { createChangeEventTrigger } from '../event/ChangeEvent'
import { nextHasMetadata } from './nextHasMetadata'
import type { LoudnessNormalizationController } from './loudness/LoudnessNormalizationController'
import { ReportableMediaError } from './error/ReportableMediaError'

export interface PlaybackControllerImplOptions {
    /**
     * An affordance when comparing the last currentTime and the new currentTime after a seek.
     * Most browsers have around 30-40 time updates per second, but some constrained devices only
     * have a few. This value needs to be large enough where the last timeupdate in a looping track
     * is at currentTime >= duration - LOOP_TIME_AFFORDANCE.
     * Default: 2
     */
    readonly loopTimeAffordance: number

    /**
     * The minimum number of seconds before the end of the next seekable range allowed for a seek
     * operation. Some browsers will never complete a seek operation if the seek is too close to
     * this end range.
     * Default: getMinSeekableBufferDefault() which is between 0.5 and 5, browser dependent.
     */
    readonly minSeekableBuffer: number

    /**
     * The number of seconds before the promise returned by play() is rejected regardless whether
     * the media element response has settled.
     * Default: 30
     */
    readonly playTimeout: number

    /**
     * The number of seconds before the promise returned by seek() is rejected.
     * Default: 30
     */
    readonly seekTimeout: number
}

export const defaultPlaybackControllerImplOptions = {
    loopTimeAffordance: 2,
    minSeekableBuffer: -1, // Default comes from getMinSeekableBufferDefault()
    playTimeout: 30,
    seekTimeout: 30,
} as const satisfies PlaybackControllerImplOptions

/**
 * Safari and Edge Legacy cannot reliably seek close to the end of a seekable range.
 * Firefox can but if the playhead reaches the end of track before the media stream is closed, an 'ended' event
 * will never fire.
 */
export function getMinSeekableBufferDefault() {
    return !hasBrowser(Browser.CHROMIUM) ? 5 : 2
}

export interface PlaybackControllerImplDeps {
    readonly media: HTMLMediaElement
    readonly loudnessNormalizationController: LoudnessNormalizationController
}

export class PlaybackControllerImpl
    extends EventHostImpl<PlaybackControllerEventMap>
    implements PlaybackController
{
    private readonly loudnessNormalizationController: LoudnessNormalizationController
    get [Symbol.toStringTag](): string {
        return 'PlaybackControllerImpl'
    }

    private _error: Error | null = null
    private readonly media: HTMLMediaElement
    private readonly domEvents: DomEventHost<HTMLMediaElementEventMap>
    private readonly disposer = createDisposer()
    private _playing = false
    private _seeking = false
    private _waiting = false

    // default user volume (0.0 to 1.0 scale)
    private userVolume: number = 1.0
    private _pendingPlay: Promise<void> | null = null
    private playAbort: Abort | null = null
    private disposeAbort = new Abort()

    readonly options: PlaybackControllerImplOptions

    constructor(
        deps: PlaybackControllerImplDeps,
        options?: Partial<PlaybackControllerImplOptions>
    ) {
        super()
        this.options = {
            ...defaultPlaybackControllerImplOptions,
            minSeekableBuffer: getMinSeekableBufferDefault(),
            ...options,
        }
        this.loudnessNormalizationController =
            deps.loudnessNormalizationController
        logInfo(this, 'constructed', this.options)
        this.media = deps.media

        const { add } = this.disposer
        add(() => {
            this.disposeAbort.abort()
            this.disposeAbort.dispose()
        })

        this.domEvents = add(
            new DomEventHost<HTMLMediaElementEventMap>(deps.media)
        )

        // Log media events.
        add(playbackStateLoggingHandler(this))

        // Reports media errors
        this.domEvents.on('error', (_) => {
            const error = new ReportableMediaError(this.media.error)
            if (error.level === ErrorLevel.SILENT) {
                // Not a fatal error, log and ignore
                logInfo(this, error.message)
                return
            }
            this._error = error
            this.dispatch('error', {
                target: this,
                error,
            })
        })

        this.initializeEvents()

        // Listen for loudness normalization changes
        add(
            this.loudnessNormalizationController.on('change', () => {
                this.refreshVolume()
            })
        )
    }

    /**
     * Updates volume with loudness gain, on the mediaElement.
     * @private
     */
    private refreshVolume(): void {
        const effectiveVolume =
            this.userVolume * this.loudnessNormalizationController.gain
        this.media.volume = Math.min(1.0, effectiveVolume) // valid range (0-1)
        logDebug(this, 'refreshVolume', {
            userVolume: this.userVolume,
            lnGain: this.loudnessNormalizationController.gain,
            effectiveVolume: this.media.volume,
        })
    }

    /**
     * Listens to select events on the media element, redispatching as playback state events.
     * @private
     */
    private initializeEvents() {
        this.initializePlainEvents()
        this.initializeChangeEvents()
        this.initializeOperationEvents()
        this.initializeMutedEvent()
        this.initializeLoopedEvent()
        this.initializeReadyStateChangeEvent()
    }

    /**
     * Re-dispatches the plain DOM events without extra information.
     *
     * @private
     */
    private initializePlainEvents() {
        // Re-dispatch html media element events exposed on the playback controller as empty events.
        for (const key of [
            'abort',
            'canPlay',
            'canPlayThrough',
            'emptied',
            'ended',
            'loadStart',
            'loadedData',
            'loadedMetadata',
            'pause',
            'play',
            'playing',
            'seeking',
            'waiting',
            'waitingForKey',
        ] as const) {
            this.domEvents.on(toLowerCase(key), () => this.dispatch(key, {}))
        }

        // Keep specific event information for progress events.

        this.domEvents.on('progress', (e) => {
            this.dispatch('progress', { loaded: e.loaded, total: e.total })
        })
    }

    /**
     * Delegates the DOM events with additional information about what the previous and current
     * values are.
     * @private
     */
    private initializeChangeEvents() {
        const changeEventGetters = {
            durationChange: () => this.duration,
            timeUpdate: () => this.currentTime,
            volumeChange: () => this.volume,
            rateChange: () => this.playbackRate,
        } as const
        for (const key of ownKeys(changeEventGetters)) {
            this.domEvents.on(
                toLowerCase(key),
                createChangeEventTrigger(changeEventGetters[key], (event) => {
                    this.dispatch(key, event)
                })
            )
        }
    }

    /**
     * Operation events provide an easy way to listen for the terminus of a state.
     * For example after a 'waiting' event, there are several different events that indicate that
     * the waiting has finished, and this API provides those events conflated into a single
     * 'waited' event.
     * @private
     */
    private initializeOperationEvents() {
        // seeking state + seeked event
        // media element has a seeked event, add operation details and set state.
        this.operationEvent(
            this.domEvents,
            'seeking',
            // A seeked event may not be emitted in certain cases such as changing tracks before the seek can finish.
            ['seeked', 'emptied'],
            () => (this._seeking = true),
            (info) => {
                this._seeking = false
                this.dispatch('seeked', info)
            }
        )

        // waiting state + waited event
        this.operationEvent(
            this,
            'waiting',
            waitedReasons,
            () => (this._waiting = true),
            (info) => {
                this._waiting = false
                this.dispatch('waited', info)
            }
        )

        // playing state + played event
        let startedTime = 0
        this.operationEvent(
            this,
            'playing',
            playedReasons,
            () => {
                this._playing = true
                startedTime = this.currentTime
            },
            (info) => {
                this._playing = false
                this.dispatch('played', {
                    ...info,
                    playbackTime: this.currentTime - startedTime,
                })
            }
        )
    }

    /**
     * When going into a state from a beginEvent, dispatches endEvent when any of the endEvents
     * is dispatched.
     *
     * This allows consumers of the playback state to listen for the exit of a state without
     * needing to know every event that ends that state.
     *
     * @param host The event host emitting the primary events.
     * @param beginEvent The event that enters a state.
     * @param endEvents A list of events that exits the entered state.
     * @param onBegin Invoked when the operation has begun.
     * @param onEnd Invoked when the operation has completed.
     */
    private operationEvent<EventMap, const EndEvent extends keyof EventMap>(
        host: ReadonlyEventHost<EventMap>,
        beginEvent: keyof EventMap,
        endEvents: readonly EndEvent[],
        onBegin: () => void,
        onEnd: (info: {
            started: number
            ended: number
            duration: number
            reason: EndEvent
        }) => void
    ) {
        let startedAt = 0
        let started = false
        host.on(beginEvent, () => {
            onBegin()
            started = true
            startedAt = Date.now()
        })
        onAny(host, endEvents, (_, event) => {
            if (started) {
                started = false
                const now = Date.now()
                onEnd({
                    started: startedAt,
                    ended: now,
                    duration: (now - startedAt) / 1000,
                    reason: event,
                })
            }
        })
    }

    /**
     * Dispatches a 'mutedChange' event when 'muted' state has changed.
     *
     * The DOM element only provides a 'volumeChange' event, which is filtered to watch when
     * muted has changed.
     *
     * @private
     */
    private initializeMutedEvent() {
        const { add } = this.disposer
        let previousMuted = this.muted

        // Dispatches a mutedChange event if the muted property changed since the last check.
        const maybeDispatchMutedChange = () => {
            if (this.muted === previousMuted) return
            previousMuted = this.muted
            this.dispatch('mutedChange', {
                previous: !this.muted,
                current: this.muted,
            })
        }
        const mutedTimeoutSlot = add(new TimeoutSlot())
        this.on('volumeChange', () => {
            maybeDispatchMutedChange()
            // The volumechange event may be emitted before the muted property change.
            // This has been observed on legacy edge and as a rare occurrence for Chrome.
            mutedTimeoutSlot.set(maybeDispatchMutedChange, 0.2)
        })
    }

    /**
     * Dispatches a looped event if loop is true and playback wraps back to the start.
     * Safari emits timeupdate events at duration and then 0 before the seeking event
     * Other browsers emit the seeking before the timeupdate near zero.
     * Firefox timeupdate after the loop is near zero, not exactly.
     *
     * @private
     */
    private initializeLoopedEvent() {
        let lastTime = 0
        this.on('timeUpdate', () => {
            if (
                this.loop &&
                !this.paused &&
                this.currentTime <= this.options.loopTimeAffordance &&
                lastTime >= this.duration - this.options.loopTimeAffordance
            ) {
                if (getUserAgentInfo().browserLike?.name === Browser.FIREFOX) {
                    // Firefox does not emit a 'playing' event after a loop, fabricate one.
                    logDebug(this, 'fabricating Firefox playing event on loop')
                    this.dispatch('playing', {})
                }
                this.dispatch('looped', {})
            }
            lastTime = this.currentTime
        })
    }

    get buffered(): ReadonlyRanges {
        return createTimeRangesReader(this.media.buffered)
    }

    get currentTime(): number {
        return this.media.currentTime
    }

    get currentTimePercent(): number {
        return this.duration > 0 ? this.currentTime / this.duration : 0
    }

    get defaultPlaybackRate(): number {
        return this.media.defaultPlaybackRate
    }

    set defaultPlaybackRate(value: number) {
        logDebug(this, `defaultPlaybackRate set to ${value}`)
        this.media.defaultPlaybackRate = value
    }

    get duration(): number {
        if (this.media.duration >= LIVE_DURATION)
            return Number.POSITIVE_INFINITY
        return this.media.duration
    }

    get ended(): boolean {
        return this.media.ended
    }

    get error(): Error | null {
        return this._error
    }

    get loop(): boolean {
        return this.media.loop
    }

    set loop(value: boolean) {
        logDebug(this, `loop set to ${value}`)
        this.media.loop = value
    }

    get muted(): boolean {
        return this.media.muted
    }

    set muted(value: boolean) {
        logDebug(this, `muted set to ${value}`)
        this.media.muted = value
    }

    get networkState(): number {
        return this.media.networkState
    }

    get paused(): boolean {
        return this.media.paused
    }

    get playbackRate(): number {
        return this.media.playbackRate
    }

    set playbackRate(value: number) {
        logDebug(this, `playbackRate set to ${value}`)
        this.media.playbackRate = value
    }

    get playing(): boolean {
        return this._playing
    }

    get preservesPitch(): boolean {
        return this.media.preservesPitch
    }

    set preservesPitch(value: boolean) {
        logDebug(this, `preservesPitch set to ${value}`)
        this.media.preservesPitch = value
    }

    get readyState(): PlaybackReadyState {
        return this.media.readyState
    }

    get seekable(): ReadonlyRanges {
        return createTimeRangesReader(this.media.seekable)
    }

    get seeking(): boolean {
        return this._seeking
    }

    get volume(): number {
        return this.userVolume
    }

    set volume(value: number) {
        logDebug(this, `volume set to ${value}`)
        this.userVolume = value
        this.refreshVolume()
    }

    get waiting(): boolean {
        return this._waiting
    }

    pause(): void {
        logDebug(this, 'pause')
        this.playAbort?.abort(
            new AbortError(
                'The play() request was interrupted by a call to pause().'
            )
        )
        this.pendingPlay = null
        this.media.pause()
    }

    private get pendingPlay(): Promise<void> | null {
        return this._pendingPlay
    }

    private set pendingPlay(value: Promise<void> | null) {
        this._pendingPlay = value
        this.dispatch('playIsPendingChange', {
            previous: value == null,
            current: value != null,
        })
    }

    play(): Promise<void> {
        logDebug(this, 'play')
        if (!this.pendingPlay) {
            const playAbort = new Abort()
            this.playAbort = playAbort
            this.pendingPlay = withAbort(
                (async () => {
                    await nextHasMetadata(this)
                    playAbort.throwIfAborted()
                    await withTimeout(
                        this.media.play(),
                        this.options.playTimeout,
                        'play() timed out after {time}s',
                        ErrorOrigin.INTERNAL,
                        ErrorLevel.SILENT
                    )
                })(),
                playAbort
            )
                .catch((reason) => {
                    this.dispatch('playRejected', { reason })
                    throw reason
                })
                .finally(() => {
                    this.pendingPlay = null
                    this.playAbort = null
                })
        }
        return this.pendingPlay
    }

    get canPlay(): boolean {
        return this.readyState >= PlaybackReadyState.HAVE_FUTURE_DATA
    }

    get canPlayThrough(): boolean {
        return this.readyState >= PlaybackReadyState.HAVE_ENOUGH_DATA
    }

    get hasMetadata(): boolean {
        return this.readyState >= PlaybackReadyState.HAVE_METADATA
    }

    get playIsPending(): boolean {
        return this.pendingPlay != null
    }

    async seekTo(time: number, tolerance = 0.5): Promise<void> {
        logDebug(this, `seekTo: ${time}`)
        const nextEvent = <K extends keyof PlaybackControllerEventMap>(
            type: K
        ): Promise<PlaybackControllerEventMap[K]> => {
            return withAbort(
                withTimeout(
                    nextEventAsPromise(this, type),
                    this.options.seekTimeout,
                    `seek timed out on ${type} event after {time}s`,
                    ErrorOrigin.INTERNAL,
                    ErrorLevel.WARN
                ),
                this.disposeAbort
            )
        }

        // Cannot seek until there are seekable ranges.
        if (!this.hasMetadata) {
            await nextEvent('loadedMetadata')
        }

        const seekable = this.seekable
        const range = seekable.getRangeAt(
            clamp(time, 0, this.duration),
            tolerance
        )
        if (range == null) {
            logWarn(
                this,
                `seekTo: seek outside of seekable ranges, seek ignored`
            )
            throw new InvalidSeekError(time, seekable, tolerance)
        }
        const clampedTime = Math.max(
            Math.min(time, range[1] - this.options.minSeekableBuffer),
            range[0]
        )

        // No-op check

        logDebug(
            this,
            `seekTo operation, requested: ${time}, actual: ${clampedTime}`
        )

        if (closeTo(clampedTime, this.currentTime, tolerance)) {
            // Within tolerance of the currentTime, no seek needed.
            logDebug(
                this,
                `seekTo: requested: ${time}, actual: ${clampedTime} no-op`
            )
        } else {
            const seeking = nextEvent('seeking')
            this.media.currentTime = clampedTime
            await seeking
            const seekedEvent = await nextEvent('seeked')
            if (seekedEvent.reason === 'emptied') {
                // Seek finished due to track unloading. Abort any pending seek.
                throw new AbortError()
            }
        }
    }

    /**
     * Dispatches a readyStateChange event when {@link readyState} changes.
     * @private
     */
    private initializeReadyStateChangeEvent() {
        let previous = this.readyState
        onAny(
            this,
            [
                'canPlay',
                'canPlayThrough',
                'emptied',
                'loadedData',
                'loadedMetadata',
                'waiting',
            ],
            () => {
                const current = this.readyState
                if (previous !== current) {
                    this.dispatch('readyStateChange', {
                        previous,
                        current,
                    })
                    previous = this.readyState
                }
            }
        )
    }

    reset() {
        if (this._error == null) {
            logDebug(this, 'reset no-op')
            return
        }
        logDebug(this, 'reset')
        this._error = null
        this.dispatch('reset', {})
    }

    /**
     * True if this controller has been disposed.
     */
    get disposed(): boolean {
        return this.disposer.disposed
    }

    dispose() {
        this.disposer.dispose()
    }
}

/**
 * Returns true if the play rejection reason is a not allowed error. This indicates that play
 * should be retried within a user interaction stack.
 * @param reason
 */
export function isNotAllowedError(
    reason: any
): reason is { name: 'NotAllowedError' } {
    return reason?.name === 'NotAllowedError'
}
