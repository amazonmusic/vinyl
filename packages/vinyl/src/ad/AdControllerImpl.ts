/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    compare,
    createDisposer,
    EventHostImpl,
    lerp,
    logDebug,
    type Maybe,
    resolveValueProvider,
    roundToNearest,
    sleep,
    sortedInsertionIndex,
} from '@amazon/vinyl-util'
import {
    type AdBreakInfo,
    type AdBreakList,
    type AdBreakPlacement,
    type AdInfo,
    type SkipControl,
    type TrackAds,
} from './AdBreakInfo'
import type {
    AdChangeReason,
    AdController,
    AdEventMap,
    AdProgressEvent,
} from './AdController'
import type { ReadonlyPlaybackController } from '../playback/ReadonlyPlaybackController'
import { AdError } from './AdError'

/**
 * The % playhead start tolerance for playback progress when emitting ad progress events.
 */
export const AD_START_TOLERANCE = 0.05

export interface AdControllerImplDeps {
    readonly playbackController: ReadonlyPlaybackController
}

export interface AdControllerImplOptions {
    /**
     * After an ad is set, the number of seconds to wait for playback to begin
     * before marking the ad as failed.
     * Default: 15
     */
    readonly adLoadTimeout: number
}

export const defaultAdControllerImplOptions: AdControllerImplOptions = {
    adLoadTimeout: 15,
}

interface Quartiles {
    first: boolean
    midpoint: boolean
    third: boolean
}

interface AdStats {
    playing: boolean
    // The currentTime at the start of playback
    timeStart: number
    // The running playback rate average
    playbackRateAvg: number
    dataPoints: number
    quartile: Quartiles
}

function createAdStats(): AdStats {
    return {
        playing: false,
        timeStart: 0,
        playbackRateAvg: 0,
        dataPoints: 0,
        quartile: {
            first: false,
            midpoint: false,
            third: false,
        },
    }
}

const emptyPlacementBreaks: Record<AdBreakPlacement, AdBreakList> = {
    preroll: [],
    midroll: [],
    postroll: [],
}

/**
 * Provider-agnostic {@link AdController}. Holds the discovered ad breaks and
 * derives enter/exit region events from playhead time updates.
 *
 * This controller is the *model* for ad playback: it knows which breaks exist,
 * which break contains the playhead, and which ad within that break is current.
 * It does NOT create, preload, or activate any tracks — that is the
 * responsibility of the {@link TrackController}.
 *
 * A break is considered active while `startTime <= currentTime < endTime`,
 * where `endTime` is `startTime + duration`. Breaks whose duration is unknown
 * (null) or breaks which restrict `jump` will become active at
 * `currentTime > startTime`
 *
 * This class contains no HLS- or DASH-specific logic; discovery code maps its
 * protocol's signals to {@link AdBreakInfo} and pushes them via
 * {@link setAds}.
 */
export class AdControllerImpl
    extends EventHostImpl<AdEventMap>
    implements AdController
{
    get [Symbol.toStringTag](): string {
        return 'AdControllerImpl'
    }

    private readonly options: AdControllerImplOptions
    private _trackAds: TrackAds | null = null
    private groupedByPlacement: Record<AdBreakPlacement, AdBreakList> =
        emptyPlacementBreaks
    // The start times of the midroll ads, used for fast midroll break find
    private midrollTimes: number[] = []

    private lastPlaybackTime = 0
    private _currentAdIndex: number = -1
    private _totalAds: number = 0
    private pendingAdBreaks: AdBreakInfo[] = []
    private pendingAds: AdInfo[] = []
    private _currentAdBreak: AdBreakInfo | null = null
    private _currentAd: AdInfo | null = null
    // Breaks permanently suppressed for this presentation (play-once breaks and
    // prerolls). Cleared only on a content change (clearCompletedAds).
    private readonly completeAdBreakIds = new Set<string>()
    // Replayable (non-play-once) midroll breaks that have played and are "spent"
    // until the playhead moves back before their start, at which point they are
    // re-armed and replay on the next forward crossing.
    private readonly spentBreakIds = new Set<string>()
    // Cumulative media-time playout across the ads of the current break, used to
    // enforce the break's playout limit and to default an unspecified resume
    // offset.
    private breakPlayoutElapsed = 0
    // The resolved skip window for the current break, or null when it has none
    // (or has not resolved yet).
    private _currentSkipControl: SkipControl | null = null
    private readonly disposer = createDisposer()
    private adStats: AdStats = createAdStats()

    constructor(
        private readonly deps: AdControllerImplDeps,
        options?: Partial<AdControllerImplOptions>
    ) {
        super()
        this.options = { ...defaultAdControllerImplOptions, ...options }
        const { add } = this.disposer
        const { playbackController } = this.deps
        add(
            playbackController.on('playing', () => {
                if (this._currentAd) {
                    const stats = this.adStats
                    if (!stats.playing) {
                        // The ad has started playing, initialize the stats.
                        stats.playing = true
                        stats.timeStart = playbackController.currentTime
                        stats.playbackRateAvg = playbackController.playbackRate
                        stats.dataPoints = 1
                    }
                    this.dispatch('adPlaying', {
                        ad: this._currentAd,
                        index: this._currentAdIndex,
                        totalAds: this._totalAds,
                    })
                }
            })
        )
        add(
            playbackController.on('seeked', (event) => {
                if (this.currentAd) {
                    this.adStats.timeStart = playbackController.currentTime
                    return
                }
                // A genuine seek back before a spent (replayable) break re-arms
                // it so it fires again on the next forward crossing. Gated on a
                // real user seek (reason 'seeked') — an 'emptied'/'playing'
                // settle from the ad→content source swap (or a hard reset's
                // MediaSource re-init) transiently reports an early currentTime
                // and would otherwise replay the break (an in-place, offset-0
                // resume would loop).
                if (event.reason !== 'seeked') return
                const time = playbackController.currentTime
                if (this.spentBreakIds.size) {
                    for (const midroll of this.groupedByPlacement.midroll) {
                        if (time < midroll.startTime) {
                            this.spentBreakIds.delete(midroll.id)
                        }
                    }
                }
            })
        )
        add(playbackController.on('timeUpdate', this.onTimeUpdate))
        add(playbackController.on('ended', () => this.endAd()))
    }

    get currentTrackAds(): TrackAds | null {
        return this._trackAds
    }

    clearCompletedAds(): void {
        this.completeAdBreakIds.clear()
        this.spentBreakIds.clear()
    }

    /**
     * Records a break as complete when it has played. Play-once breaks (and
     * prerolls, which are one-shot per presentation) are suppressed permanently;
     * replayable midrolls are only marked "spent" so they can re-arm on a
     * seek-back. Postrolls are event-driven ({@link enterPostroll}) and need no
     * suppression.
     */
    private markBreakComplete(adBreak: AdBreakInfo): void {
        if (adBreak.once || adBreak.placement === 'preroll') {
            this.completeAdBreakIds.add(adBreak.id)
        } else if (adBreak.placement === 'midroll') {
            this.spentBreakIds.add(adBreak.id)
        }
    }

    private isBreakSuppressed(id: string): boolean {
        return this.completeAdBreakIds.has(id) || this.spentBreakIds.has(id)
    }

    /** The media-time the current ad has actually played, or 0 if not playing. */
    private adElapsed(): number {
        const stats = this.adStats
        return stats.playing
            ? Math.max(
                  0,
                  this.deps.playbackController.currentTime - stats.timeStart
              )
            : 0
    }

    /**
     * Computes whether the current ad may be skipped and, when not yet, how many
     * seconds remain until it can. A `skip` restriction blocks it outright;
     * otherwise a resolved skip window gates it by the elapsed break playout, and
     * with no window the ad is freely skippable.
     */
    private resolveSkipState(
        adBreak: AdBreakInfo,
        breakPlayed: number
    ): { readonly canSkip: boolean; readonly skipIn: number | null } {
        if (adBreak.restrict.skip === true) {
            return { canSkip: false, skipIn: null }
        }
        const skip = this._currentSkipControl
        if (!skip) {
            return { canSkip: true, skipIn: null }
        }
        if (breakPlayed < skip.offset) {
            return { canSkip: false, skipIn: skip.offset - breakPlayed }
        }
        const end =
            skip.duration != null ? skip.offset + skip.duration : Infinity
        return { canSkip: breakPlayed < end, skipIn: null }
    }

    setAds(value: Maybe<TrackAds>): void {
        const previous = this._trackAds
        const current = value ?? null
        // Ads carry the URI of the track they belong to. When that changes (a
        // different track, or ads cleared), any ad currently playing belongs to
        // the old presentation and its state must not leak into the new one.
        const trackChanged = previous?.trackUri !== current?.trackUri
        this._trackAds = current
        this.groupedByPlacement = {
            ...emptyPlacementBreaks,
            ...Object.groupBy(
                value?.adBreaks ?? [],
                ({ placement }) => placement
            ),
        }
        this.midrollTimes = this.groupedByPlacement.midroll.map(
            ({ startTime }) => startTime
        )

        logDebug(this, 'setAds', value)
        this.dispatch('currentTrackAdsChange', {
            previous,
            current,
        })
        if (trackChanged) {
            // Tear down any in-flight ad from the previous track.
            this._currentAd = null
            this.pendingAdBreaks = []
            this.setCurrentAdBreak(null)
        }
        if (current === this._trackAds) {
            // Guarded to allow currentTrackAdsChange handlers to interrupt the ads.
            this.lastPlaybackTime = 0
            this.setPendingBreaks(this.groupedByPlacement.preroll)
        }
    }

    skipAdBreak(): void {
        const adBreak = this._currentAdBreak
        if (!adBreak) {
            logDebug(this, 'skipAdBreak, no-op')
            return
        }
        logDebug(this, 'skipAdBreak, active break id:', adBreak.id)
        this.markBreakComplete(adBreak)
        this.completeAd('skipped')
        this.setCurrentAdBreak(null)
        this.pollPendingAds()
    }

    private completeAdBreak(): void {
        const adBreak = this._currentAdBreak
        if (!adBreak) {
            logDebug(this, 'completeAdBreak no-op')
            return
        }
        logDebug(this, 'completeAdBreak, active break id:', adBreak.id)
        this.markBreakComplete(adBreak)
        this.setCurrentAdBreak(null)
    }

    get currentAdBreak(): AdBreakInfo | null {
        return this._currentAdBreak
    }

    private setCurrentAdBreak(value: Maybe<AdBreakInfo>) {
        const previous = this._currentAdBreak
        const current = value ?? null
        if (previous?.id === value?.id) return
        this._currentAdBreak = current
        // Each break accounts its own playout independently.
        this.breakPlayoutElapsed = 0
        logDebug(
            this,
            'currentAdBreak changed previous:',
            previous,
            'next: ',
            value
        )
        this.dispatch('currentAdBreakChange', {
            previous,
            current,
        })

        this.pendingAds = []
        this._currentAdIndex = -1
        this._totalAds = 0
        this._currentSkipControl = null
        // Resolve the break's skip window alongside its ads (both share one
        // memoized fetch). A failure just leaves the break with no skip window;
        // the ads resolution below reports the error.
        resolveValueProvider(value?.skipControl)
            .then((skipControl) => {
                if (this._currentAdBreak === value) {
                    this._currentSkipControl = skipControl ?? null
                }
            })
            .catch(() => undefined)
        resolveValueProvider(value?.ads)
            .then((ads) => {
                if (this._currentAdBreak !== value) return
                const adsList = ads?.slice() ?? []
                this.pendingAds = adsList
                this._currentAdIndex = 0
                this._totalAds = adsList.length
                if (!this._totalAds) {
                    // A break that resolves to no playable ads must not trap the
                    // playhead; mark it complete and advance to any next break.
                    this.completeAdBreak()
                }
                this.pollPendingAds()
            })
            .catch((error) => {
                this.failAd(error)
            })
    }

    /**
     * Polls the pending ad queue, when that is empty, polls the pending ad break queue.
     */
    private pollPendingAds() {
        if (this._currentAd || this.disposed) return
        const nextAd = this.pendingAds.shift()
        if (nextAd) {
            this.startAd(nextAd)
        } else {
            if (this._currentAdBreak) {
                this.markBreakComplete(this._currentAdBreak)
            }
            const nextAdBreak = this.pendingAdBreaks.shift()
            this.setCurrentAdBreak(nextAdBreak)
        }
    }

    get currentAd(): AdInfo | null {
        return this._currentAd
    }

    /**
     * Enters the given ad, resolving when the ad has been completed for any reason.
     *
     * Dispatches adEntered
     *
     */
    private startAd(value: AdInfo): void {
        this._currentAd = value
        this.adStats = createAdStats()
        const stats = this.adStats
        logDebug(this, 'adEntered', value)
        this.dispatch('adEntered', {
            ad: value,
            index: this._currentAdIndex,
            totalAds: this._totalAds,
        })
        void sleep(this.options.adLoadTimeout).then(() => {
            if (this.adStats === stats && !stats.playing) {
                this.failAd(
                    new AdError(
                        `Ad failed to start after ${this.options.adLoadTimeout} seconds`
                    )
                )
            }
        })
    }

    private completeAd(reason: AdChangeReason) {
        const ad = this._currentAd
        if (!ad) return
        const adBreak = this._currentAdBreak!
        logDebug(this, 'adCompleted', ad, 'reason:', reason)
        // Fold this ad's actual playout into the break total before clearing it.
        this.breakPlayoutElapsed += this.adElapsed()
        this._currentAd = null
        const index = this._currentAdIndex++
        // Resume at the scheduled break start plus its resume offset, defaulting
        // to the actual playout when the offset is unspecified (bounded by the
        // playout limit). max() keeps a forward seek from being rewound.
        const playout =
            adBreak.playoutLimit != null
                ? Math.min(this.breakPlayoutElapsed, adBreak.playoutLimit)
                : this.breakPlayoutElapsed
        // The resume offset only advances the primary timeline for midrolls: a
        // preroll resumes at the content's own start (TrackController uses
        // adParent.config) and a postroll parks at the content end, so applying
        // the offset there would push the resume past the content duration.
        const effectiveOffset =
            adBreak.placement === 'midroll'
                ? (adBreak.resumeOffset ?? playout)
                : 0
        const resumePosition = Math.max(
            this.lastPlaybackTime,
            adBreak.startTime + effectiveOffset
        )
        this.dispatch('adCompleted', {
            adBreak,
            ad,
            reason,
            resumePosition,
            index,
            totalAds: this._totalAds,
        })
        if (!this.pendingAds.length) {
            this.completeAdBreak()
        }
    }

    /**
     * Checks if the playhead has entered a time to activate a midroll ad.
     */
    private onTimeUpdate = () => {
        // Don't re-evaluate while a break is active — the playhead reflects the
        // ad track's time, not the content timeline.
        const pC = this.deps.playbackController
        const adBreak = this.currentAdBreak
        if (adBreak) {
            // Ad progress events
            const ad = this.currentAd
            const stats = this.adStats
            if (ad) {
                // Surface elapsed/remaining time for the ad and the break as a
                // whole so applications don't derive it from the media duration.
                const adPlayed = this.adElapsed()
                const adTotal =
                    ad.duration ?? (isFinite(pC.duration) ? pC.duration : null)
                const breakPlayed = this.breakPlayoutElapsed + adPlayed
                const breakTotal = adBreak.playoutLimit ?? adBreak.duration
                const { canSkip, skipIn } = this.resolveSkipState(
                    adBreak,
                    breakPlayed
                )
                this.dispatch('adTimeUpdate', {
                    ad,
                    index: this._currentAdIndex,
                    totalAds: this._totalAds,
                    adCurrentTime: adPlayed,
                    adTimeRemaining:
                        adTotal != null
                            ? Math.max(0, adTotal - adPlayed)
                            : null,
                    breakCurrentTime: breakPlayed,
                    breakTimeRemaining:
                        breakTotal != null
                            ? Math.max(0, breakTotal - breakPlayed)
                            : null,
                    canSkip,
                    skipIn,
                })
            }
            if (ad && isFinite(pC.duration)) {
                // Take a running average of the playback rate. Applications can
                // use this to detect tampering when emitting metrics.
                stats.dataPoints++
                stats.playbackRateAvg = lerp(
                    stats.playbackRateAvg,
                    pC.playbackRate,
                    1 / stats.dataPoints
                )

                // If the ad's duration is set, take the shorter of the ad duration
                const currProgress = pC.currentTimePercent
                const progressStart = stats.timeStart / pC.duration
                if (
                    !stats.quartile.first &&
                    currProgress > 0.25 &&
                    progressStart < AD_START_TOLERANCE
                ) {
                    this.dispatch(
                        'adFirstQuartile',
                        this.createAdProgressEvent(ad, stats)
                    )
                }
                if (
                    !stats.quartile.midpoint &&
                    currProgress > 0.5 &&
                    progressStart < 0.25 + AD_START_TOLERANCE
                ) {
                    this.dispatch(
                        'adMidpoint',
                        this.createAdProgressEvent(ad, stats)
                    )
                }
                if (
                    !stats.quartile.third &&
                    currProgress > 0.75 &&
                    progressStart < 0.5 + AD_START_TOLERANCE
                ) {
                    this.dispatch(
                        'adThirdQuartile',
                        this.createAdProgressEvent(ad, stats)
                    )
                }
                // adEnded is not on progress but on a call to `endAd()`.
            }
            // Enforce playout limits independent of a finite content duration so
            // live ads with a declared duration are still bounded.
            if (ad && stats.playing) {
                const elapsed = Math.max(0, pC.currentTime - stats.timeStart)
                const limit = adBreak.playoutLimit
                if (
                    limit != null &&
                    this.breakPlayoutElapsed + elapsed >= limit
                ) {
                    // The break's total playout limit is reached: end the whole
                    // break, dropping any ads that have not started.
                    this.pendingAds = []
                    this.endAd()
                } else if (ad.duration != null && elapsed >= ad.duration) {
                    // This ad reached its declared duration: advance to the next.
                    this.endAd()
                }
            }
            return
        }

        const time = pC.currentTime
        const index = sortedInsertionIndex(this.midrollTimes, time, compare) - 1
        if (index >= 0) {
            const newPending: AdBreakInfo[] = []
            const midrolls = this.groupedByPlacement.midroll
            for (let i = index; i < midrolls.length; i++) {
                const midroll = midrolls[i]
                if (time < midroll.startTime) break
                if (this.isBreakSuppressed(midroll.id)) continue
                const duration =
                    midroll.duration == null || midroll.restrict.jump
                        ? Number.MAX_VALUE
                        : midroll.duration
                if (time < midroll.startTime + duration) {
                    newPending.push(midroll)
                }
            }
            if (newPending.length) {
                this.lastPlaybackTime = time
                this.setPendingBreaks(newPending)
            }
        }
    }

    private setPendingBreaks(newPending: AdBreakList): void {
        this.pendingAdBreaks = newPending.filter(
            (adBreak) => !this.isBreakSuppressed(adBreak.id)
        )
        this._currentAdIndex = 0
        logDebug(this, `setPendingBreaks len=${newPending.length}`)
        if (newPending.length) {
            this.pollPendingAds()
        }
    }

    enterPostroll(): void {
        this.lastPlaybackTime = this.deps.playbackController.duration
        this.setPendingBreaks(this.groupedByPlacement.postroll)
    }

    private createAdProgressEvent(
        ad: AdInfo,
        adStats: AdStats
    ): AdProgressEvent {
        return {
            ad,
            // Snapped to nearest 0.1 to avoid ~1.0
            playbackRateAvg: roundToNearest(adStats.playbackRateAvg, 0.1),
            index: this._currentAdIndex,
            totalAds: this._totalAds,
        }
    }

    skipAd(): void {
        const ad = this._currentAd
        if (!ad) return
        this.completeAd('skipped')
        this.pollPendingAds()
    }

    failAd(error: Error): void {
        const adBreak = this._currentAdBreak
        if (!adBreak) return
        // Capture the failing ad before completeAd() clears it, so the
        // adError event can distinguish an individual-ad failure from an
        // ad-list load failure (currentAd == null).
        const currentAd = this._currentAd
        this.completeAd('error')
        this.dispatch('adError', {
            error,
            adBreak,
            currentAd,
        })
        this.pollPendingAds()
    }

    private endAd(): void {
        const ad = this._currentAd
        if (!ad) return
        const adStats = this.adStats
        this.completeAd('ended')
        this.dispatch('adEnded', this.createAdProgressEvent(ad, adStats))
        this.pollPendingAds()
    }

    get disposed(): boolean {
        return this.disposer.disposed
    }

    /**
     * Disposes this controller, removes all listeners.
     */
    dispose(): void {
        super.dispose()
        this.disposer.dispose()
    }
}
