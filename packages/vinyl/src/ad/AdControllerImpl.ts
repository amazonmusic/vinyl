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
    private readonly completeAdBreakIds = new Set<string>()
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
            playbackController.on('seeked', () => {
                if (this.currentAd) {
                    this.adStats.timeStart = playbackController.currentTime
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
        this.completeAdBreakIds.add(adBreak.id)
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
        this.completeAdBreakIds.add(adBreak.id)
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
                this.completeAdBreakIds.add(this._currentAdBreak.id)
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
        logDebug(this, 'adCompleted', ad, 'reason:', reason)
        this._currentAd = null
        const index = this._currentAdIndex++
        this.dispatch('adCompleted', {
            adBreak: this._currentAdBreak!,
            ad,
            reason,
            // TODO: Ads can have an ad offset that this needs to max against
            resumeOffset: this.lastPlaybackTime,
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
        if (this.currentAdBreak) {
            // Ad progress events
            const ad = this.currentAd
            const stats = this.adStats
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
                // TODO: restrict playback to adinfo duration
                // TODO: ad X-RESUME-OFFSET
                // adEnded is not on progress but on a call to `endAd()`.
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
                if (this.completeAdBreakIds.has(midroll.id)) continue
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
            (adBreak) => !this.completeAdBreakIds.has(adBreak.id)
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
