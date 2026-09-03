/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createDisposer,
    createLogPrefix,
    EventHostImpl,
    getElementOrDefault,
    lerp,
    logDebug,
    logError,
    type LogTarget,
    logVerbose,
    type Maybe,
    memoize,
    noop,
    resolveValueProvider,
    roundToNearest,
    sleep,
    sortedInsertionIndex,
    type Unsubscribe,
} from '@amazon/vinyl-util'
import {
    type AdBreakInfo,
    type AdBreakList,
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
import type { AdsProvider } from './AdsProvider'

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

    /**
     * How many seconds ahead of a midroll or postroll break to emit `adPreload`
     * (so its ad assets can be warmed before the playhead reaches it). Used only
     * when the break itself carries no {@link AdBreakInfo.resolutionTimeOffset};
     * a break's own offset always takes precedence.
     * Default: 10
     */
    readonly preloadAheadTime: number
}

export const defaultAdControllerImplOptions: AdControllerImplOptions = {
    adLoadTimeout: 15,
    preloadAheadTime: 10,
}

interface Quartiles {
    first: boolean
    midpoint: boolean
    third: boolean
}

interface AdBreakState {
    readonly adBreak: AdBreakInfo
    readonly adState: AdState | null

    completedReason: AdChangeReason | null

    playoutElapsed: number

    /**
     * Resolves the break's ad list (once, memoized) and advances to the next
     * ad in it, returning that ad's state — or null when the list is exhausted.
     */
    nextAd(): Promise<AdState | null>

    /**
     * Clears any pending and current ads.
     */
    clear(): void
}

interface AdState {
    readonly parentBreak: AdBreakState
    readonly ad: AdInfo
    readonly index: number
    readonly totalAds: number
    started: boolean
    // The currentTime at the start of playback
    timeStart: number
    // The running playback rate average
    playbackRateAvg: number
    dataPoints: number
    readonly quartile: Quartiles
    completedReason: AdChangeReason | null
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
 * protocol's signals to {@link AdBreakInfo} exposed by an
 * {@link AdsProvider.getAds}, which this controller reads once the provider is
 * set via {@link AdController.setAdsProvider} (and re-reads on `adsChange`).
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
    private adsProviderSub: Unsubscribe | null = null
    private adsProvider: AdsProvider | null = null
    // The start times of the midroll ads, used for fast midroll break find
    private midrollAds: AdBreakList = []
    // Midroll and postroll breaks, sorted by start time — the breaks eligible
    // for the ahead-of-time `adPreload` signal (prerolls are preloaded up front).
    private preloadableBreaks: AdBreakList = []
    // Breaks for which `adPreload` has already been emitted on the current
    // approach; cleared on content change and when a break is re-armed by a
    // seek back, so a re-approached break preloads again.
    private readonly preloadedBreakIds = new Set<AdBreakKey>()

    private lastPlaybackTime = 0
    private pendingAdBreaks: AdBreakInfo[] = []
    // Breaks permanently suppressed for this presentation (play-once breaks and
    // prerolls). Cleared only on a content change (clearCompletedAds).
    private readonly completeAdBreakIds = new Set<AdBreakKey>()
    // Replayable (non-play-once) midroll breaks that have played and are "spent"
    // until the playhead moves back before their start, at which point they are
    // re-armed and replay on the next forward crossing.
    private readonly spentBreakIds = new Set<AdBreakKey>()
    private readonly disposer = createDisposer()
    private adBreakState: AdBreakState | null = null
    private loadingNext = false

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
                if (this.adState) {
                    const adState = this.adState
                    if (!adState.started) {
                        // The ad has started playing, initialize the state.
                        adState.started = true
                        adState.timeStart = playbackController.currentTime
                        adState.playbackRateAvg =
                            playbackController.playbackRate
                        adState.dataPoints = 1
                    }
                    this.dispatch('adPlaying', {
                        adBreak: adState.parentBreak.adBreak,
                        ad: adState.ad,
                        index: adState.index,
                        totalAds: adState.totalAds,
                    })
                }
            })
        )
        add(
            playbackController.on('seeked', (event) => {
                if (this.adState) {
                    this.adState.timeStart = playbackController.currentTime
                    return
                }
                // A genuine seek back before a break re-arms it: a spent
                // (replayable) break fires again on the next forward crossing,
                // and its preload signal re-arms so it warms again on approach.
                if (event.reason !== 'seeked') return
                const time = playbackController.currentTime
                for (const adBreak of this.preloadableBreaks) {
                    if (time < adBreak.startTime) {
                        const key = adBreakKey(adBreak)
                        this.spentBreakIds.delete(key)
                        this.preloadedBreakIds.delete(key)
                    }
                }
            })
        )
        add(playbackController.on('timeUpdate', this.onTimeUpdate))
        add(
            playbackController.on('ended', () => {
                if (this.adState) this.endAd(this.adState)
            })
        )
    }

    clearCompletedAds(): void {
        this.completeAdBreakIds.clear()
        this.spentBreakIds.clear()
        this.preloadedBreakIds.clear()
    }

    private isBreakSuppressed(adBreak: AdBreakInfo): boolean {
        const key = adBreakKey(adBreak)
        return this.completeAdBreakIds.has(key) || this.spentBreakIds.has(key)
    }

    /** The media-time the current ad has actually played, or 0 if not playing. */
    private adElapsed(): number {
        const adState = this.adState
        return adState?.started
            ? Math.max(
                  0,
                  this.deps.playbackController.currentTime - adState.timeStart
              )
            : 0
    }

    /**
     * Computes whether the current ad may be skipped and, when not yet, how many
     * seconds remain until it can. A `skip` restriction blocks it outright;
     * otherwise a resolved skip window gates it by the elapsed break playout, and
     * with no window the ad is freely skippable.
     */
    private async resolveSkipState(
        adBreakState: AdBreakState,
        breakPlayed: number
    ): Promise<{ readonly canSkip: boolean; readonly skipIn: number | null }> {
        const { adBreak } = adBreakState
        if (adBreak.restrict.skip === true) {
            return { canSkip: false, skipIn: null }
        }
        const skipControl = await resolveValueProvider(
            adBreak.skipControl
        ).catch((_v) => null)
        if (!skipControl) {
            return { canSkip: true, skipIn: null }
        }
        if (breakPlayed < skipControl.offset) {
            return { canSkip: false, skipIn: skipControl.offset - breakPlayed }
        }
        const end =
            skipControl.duration != null
                ? skipControl.offset + skipControl.duration
                : Infinity
        return { canSkip: breakPlayed < end, skipIn: null }
    }

    get currentTrackAds(): TrackAds | null {
        return this._trackAds
    }

    private setTrackAds(value: Maybe<TrackAds>): void {
        const previous = this._trackAds
        const current = value ?? null
        this._trackAds = current

        this.midrollAds = (value?.adBreaks ?? []).filter(
            (adBreak) => adBreak.placement === 'midroll'
        )
        // Midroll + postroll breaks are eligible for the ahead-of-time preload
        // signal. adBreaks are already sorted by start time, so this stays sorted.
        this.preloadableBreaks = (value?.adBreaks ?? []).filter(
            (adBreak) => adBreak.placement !== 'preroll'
        )

        logDebug(this, 'setTrackAds', value)
        this.dispatch('currentTrackAdsChange', {
            previous,
            current,
        })
    }

    /**
     * Returns a function that returns true if the ads provider has changed
     * since the callback was created.
     */
    private providerInterrupted(): () => boolean {
        const provider = this.adsProvider
        return () => this.disposed || provider !== this.adsProvider
    }

    setAdsProvider(provider: AdsProvider | null): void {
        if (this.adsProvider === provider) return
        this.pendingAdBreaks = []
        this.completeAdBreak(this.adBreakState, 'contentChange')

        this.adsProviderSub?.()
        const { add, dispose } = createDisposer()
        this.adsProviderSub = dispose
        this.adsProvider = provider
        const interrupted = this.providerInterrupted()
        this.clearCompletedAds()
        this.setTrackAds(null)

        if (!provider) return
        const refreshAds = () => {
            provider
                .getAds()
                .then((ads) => {
                    if (interrupted()) return
                    this.setTrackAds(ads)
                })
                .catch((error) => {
                    // Ad discovery failed for the provider. There is no active
                    // break to surface an adError against, so log it rather
                    // than routing through failAd (which would no-op with no
                    // active ad and swallow the failure silently).
                    if (interrupted()) return
                    logError(this, 'ad discovery failed', error)
                })
        }
        add(provider.on('adsChange', refreshAds))
        refreshAds()
    }

    async enterPreroll(): Promise<AdBreakInfo | null> {
        return this.enterRoll('preroll')
    }

    async enterPostroll(): Promise<AdBreakInfo | null> {
        return this.enterRoll('postroll')
    }

    private async enterRoll(
        placement: 'preroll' | 'postroll'
    ): Promise<AdBreakInfo | null> {
        if (!this.adsProvider) return null
        logVerbose(this, `checking for ${placement} ads`)
        this.lastPlaybackTime = this.deps.playbackController.currentTime
        const interrupted = this.providerInterrupted()
        return this.adsProvider
            .getAds()
            .then((ads) => {
                if (interrupted()) {
                    logVerbose(
                        this,
                        `interrupted, no pending breaks set for ${placement}`
                    )
                    return null
                }
                this.setPendingBreaks(
                    ads.adBreaks.filter(
                        (adBreak) => adBreak.placement === placement
                    )
                )
                return this.currentAdBreak
            })
            .catch(() => {
                return null
            })
    }

    // True when we have an ads provider set. Callers gate off this AND their
    // own "no ad break in progress" checks (currentAdBreak / pendingAdBreaks),
    // so this is only about "a provider has committed", not track activation.
    private get hasProvider(): boolean {
        return this.adsProvider != null
    }

    skipAdBreak(): void {
        const adBreakState = this.adBreakState
        if (!adBreakState) {
            logDebug(this, 'skipAdBreak, no-op')
            return
        }
        logDebug(this, 'skipAdBreak, active break id:', adBreakState.adBreak.id)
        this.completeAdBreak(adBreakState, 'skipped')
        this.nextAdOrBreak()
    }

    /**
     * Marks an ad break as completed (or 'spent' and replayable), emits an `adBreakCompleted` event.
     */
    private completeAdBreak(
        adBreakState: Maybe<AdBreakState>,
        reason: AdChangeReason
    ): void {
        if (!adBreakState || adBreakState.completedReason) {
            logDebug(this, 'completeAdBreak, no-op')
            return
        }
        const { adBreak } = adBreakState
        adBreakState.completedReason = reason
        const key = adBreakKey(adBreak)
        // A non-once midroll ad may be replayed if the region is re-entered
        // due to a back-seek.
        if (
            adBreak.once ||
            adBreak.placement === 'preroll' ||
            adBreak.placement === 'postroll'
        ) {
            this.completeAdBreakIds.add(key)
        } else {
            // Non-once midroll
            this.spentBreakIds.add(key)
        }

        // Interstitials play on a separate track, so the content timeline never
        // advances during the break: content resumes at the cue point plus any
        // explicit offset (default 0). max() keeps a forward seek from being
        // rewound.
        const resumePosition = Math.max(
            this.lastPlaybackTime,
            adBreak.startTime + (adBreak.resumeOffset ?? 0)
        )

        this.completeAd(adBreakState.adState, reason) // does nothing if no current ad
        logDebug(
            this,
            `adBreakCompleted, active break id:${adBreak.id} reason:${reason} resumePosition:${resumePosition}`
        )
        if (adBreakState === this.adBreakState) {
            this.adBreakState = null
        }
        this.dispatch('adBreakCompleted', { adBreak, resumePosition, reason })
    }

    get currentAdBreak(): AdBreakInfo | null {
        return this.adBreakState?.adBreak ?? null
    }

    /**
     * Marks an ad as completed and emits an `adCompleted` event.
     */
    private completeAd(adState: Maybe<AdState>, reason: AdChangeReason) {
        if (!adState || adState.completedReason) return // no-op
        logDebug(
            this,
            `adCompleted id=${adState.ad.id} reason=${reason} index=${adState.index} totalAds=${adState.totalAds}`
        )
        // Fold this ad's actual playout into the break total before clearing it.
        adState.parentBreak.playoutElapsed += this.adElapsed()
        adState.completedReason = reason
        this.dispatch('adCompleted', {
            adBreak: adState.parentBreak.adBreak,
            ad: adState.ad,
            reason,
            index: adState.index,
            totalAds: adState.totalAds,
        })
        if (adState.index >= adState.totalAds - 1) {
            this.completeAdBreak(adState.parentBreak, reason)
        }
    }

    /**
     * Polls the next pending ad and activates it.
     * When there are no remaining ads, activates the next ad break (if any).
     */
    private nextAdOrBreak() {
        if (this.disposed || this.loadingNext) return
        const adBreakState = this.adBreakState
        if (!adBreakState && !this.pendingAdBreaks.length) {
            logDebug(this, 'nextAdOrBreak no-op')
            return
        }
        logDebug(this, 'nextAdOrBreak')
        this.loadingNext = true

        const nextAd = async (adBreakState: AdBreakState) => {
            logVerbose(this, 'nextAd')
            try {
                const ad = await adBreakState.nextAd()
                // The break may have been completed or swapped out (a content
                // change, skip, or playout-limit) while its ads were resolving;
                // don't start an ad for an abandoned break.
                if (this.disposed || adBreakState.completedReason) return
                if (ad) {
                    this.startAd(ad)
                } else {
                    // No remaining ads in this break
                    logVerbose(this, 'no remaining ads')
                    this.completeAdBreak(adBreakState, 'ended')
                    await nextBreak()
                }
            } catch (error) {
                if (this.disposed) return
                // The ad list failed to resolve: surface the error, complete
                // this break so content can resume, then advance to any pending
                // break. Re-calling nextAdOrBreak() here would no-op (loadingNext
                // is still held by this in-flight call) AND would leave the break
                // stuck non-null, permanently blocking midroll ingress.
                this.dispatch('adError', {
                    adBreak: adBreakState.adBreak,
                    currentAd: null,
                    error,
                })
                this.completeAdBreak(adBreakState, 'error')
                await nextBreak()
            }
        }

        const nextBreak = async () => {
            logVerbose(this, 'nextBreak')
            if (this.pendingAdBreaks.length) {
                // There are pending breaks, take the next one and start its first ad.
                const adBreak = this.pendingAdBreaks.shift()!
                this.adBreakState = createAdBreakState(adBreak)
                logDebug(this, 'adBreakEntered', adBreak)
                this.dispatch('adBreakEntered', { adBreak })
                await nextAd(this.adBreakState)
            } else {
                logDebug(this, 'no remaining breaks')
            }
        }

        ;(async () => {
            if (adBreakState) {
                await nextAd(adBreakState)
            } else {
                await nextBreak().catch(noop)
            }
        })()
            .catch(noop)
            .finally(() => {
                this.loadingNext = false
            })
    }

    get currentAd(): AdInfo | null {
        return this.adState?.ad ?? null
    }

    private get adState(): AdState | null {
        return this.adBreakState?.adState ?? null
    }

    private startAd(adState: AdState): void {
        const { ad, index, totalAds } = adState
        logDebug(this, 'adEntered', adState.ad)
        this.dispatch('adEntered', {
            adBreak: adState.parentBreak.adBreak,
            ad,
            index,
            totalAds,
        })
        this.emitTimeUpdate(adState).catch(noop)
        sleep(this.options.adLoadTimeout)
            .then(() => {
                if (this.disposed) return
                if (this.adState === adState && !adState.started) {
                    this.failAd(
                        new AdError(
                            `Ad failed to start after ${this.options.adLoadTimeout} seconds`
                        )
                    )
                }
            })
            .catch(noop)
    }

    /**
     * Checks if the playhead has entered a time to activate a midroll ad.
     */
    private onTimeUpdate = (): void => {
        const adBreak = this.currentAdBreak
        const adState = this.adState
        if (adBreak) {
            // Ad progress events
            if (adState && adState.completedReason == null) {
                this.emitAdProgressEvents(adState).catch(noop)
                this.enforcePlayoutLimits(adState)
            }
            return
        }
        const pC = this.deps.playbackController
        if (this.hasProvider && pC.playing && !this.pendingAdBreaks.length) {
            // Not an ad playing, main content.
            this.lastPlaybackTime = pC.currentTime
            this.checkAdPreload(pC.currentTime)
            this.checkMidrollIngress()
        }
    }

    /**
     * Emits `adPreload` once for each midroll/postroll break the playhead is
     * approaching — within (the break's {@link AdBreakInfo.resolutionTimeOffset}
     * or, when absent, the `preloadAheadTime` option) seconds before its start —
     * so a consumer can resolve and warm the break's assets before entry.
     * Suppressed (played-once/spent) breaks are skipped.
     */
    private checkAdPreload(time: number): void {
        for (const adBreak of this.preloadableBreaks) {
            const key = adBreakKey(adBreak)
            if (this.preloadedBreakIds.has(key)) continue
            if (this.isBreakSuppressed(adBreak)) continue
            const offset =
                adBreak.resolutionTimeOffset ?? this.options.preloadAheadTime
            // Only ahead of the break; at/after its start, ingress takes over.
            if (
                time >= adBreak.startTime - offset &&
                time < adBreak.startTime
            ) {
                this.preloadedBreakIds.add(key)
                logDebug(this, 'adPreload', adBreak.id)
                this.dispatch('adPreload', { adBreak })
            }
        }
    }

    /**
     * Main content with ad breaks is playing, check if we have entered a midroll region.
     */
    private checkMidrollIngress(): void {
        const time = this.deps.playbackController.currentTime
        const midrolls = this.midrollAds
        // Upper bound: the first midroll whose startTime is strictly after the
        // playhead. Every candidate break is at an index before it.
        const upper = sortedInsertionIndex(
            midrolls,
            time,
            (time, ad) => time - ad.startTime
        )
        const newPending: AdBreakInfo[] = []
        // Scan every break at or before the playhead, ascending (timeline
        // order), so tied start times and an earlier still-open break that
        // contains the playhead (e.g. after a seek into or over it) are all
        // considered — not just the single nearest preceding break.
        for (let i = 0; i < upper; i++) {
            const midroll = midrolls[i]
            if (this.isBreakSuppressed(midroll)) continue
            const duration =
                midroll.duration == null || midroll.restrict.jump
                    ? Number.MAX_VALUE
                    : midroll.duration
            if (time < midroll.startTime + duration) {
                newPending.push(midroll)
            }
        }
        if (newPending.length) {
            logVerbose(this, 'setting midrolls')
            this.setPendingBreaks(newPending)
        }
    }

    /**
     * Emits events for `adTimeUpdate`, `adFirstQuartile`, `adMidpoint`, and
     * `adThirdQuartile`.
     * (Does not emit `adCompleted`)
     */
    private async emitAdProgressEvents(adState: AdState): Promise<void> {
        const pC = this.deps.playbackController
        await this.emitTimeUpdate(adState)
        if (isFinite(pC.duration) && pC.duration > 0) {
            // Take a running average of the playback rate. Applications can
            // use this to detect tampering when emitting metrics.
            adState.dataPoints++
            adState.playbackRateAvg = lerp(
                adState.playbackRateAvg,
                pC.playbackRate,
                1 / adState.dataPoints
            )

            // If the ad's duration is set, take the shorter of the ad duration
            const currProgress = pC.currentTimePercent
            const progressStart = adState.timeStart / pC.duration
            if (
                !adState.quartile.first &&
                currProgress > 0.25 &&
                progressStart < AD_START_TOLERANCE
            ) {
                this.dispatch('adFirstQuartile', createAdProgressEvent(adState))
            }
            if (
                !adState.quartile.midpoint &&
                currProgress > 0.5 &&
                progressStart < 0.25 + AD_START_TOLERANCE
            ) {
                this.dispatch('adMidpoint', createAdProgressEvent(adState))
            }
            if (
                !adState.quartile.third &&
                currProgress > 0.75 &&
                progressStart < 0.5 + AD_START_TOLERANCE
            ) {
                this.dispatch('adThirdQuartile', createAdProgressEvent(adState))
            }
            // adEnded is not on progress but on a call to `endAd()`.
        }
    }

    private async emitTimeUpdate(adState: AdState): Promise<void> {
        const pC = this.deps.playbackController
        const { ad, parentBreak } = adState
        // Surface elapsed/remaining time for the ad and the break as a
        // whole so applications don't derive it from the media duration.
        const adPlayed = this.adElapsed()
        const adBreak = parentBreak.adBreak
        const naturalAdTotal =
            ad.duration ?? (isFinite(pC.duration) ? pC.duration : null)
        // The break's playout limit is a budget shared across all its ads, so
        // the current ad can run no longer than the budget left after the ads
        // that already played. Cap its reported total by that remainder —
        // matching enforcePlayoutLimits, which cuts the ad (and break) off at
        // exactly this point. Without the cap adTimeRemaining over-reports (the
        // full asset duration) while the ad is actually stopped at the limit.
        const limit = adBreak.playoutLimit
        const adTotal =
            limit != null
                ? Math.min(
                      naturalAdTotal ?? Infinity,
                      Math.max(0, limit - parentBreak.playoutElapsed)
                  )
                : naturalAdTotal
        const breakPlayed = parentBreak.playoutElapsed + adPlayed
        const breakTotal = limit ?? adBreak.duration
        const { canSkip, skipIn } = await this.resolveSkipState(
            parentBreak,
            breakPlayed
        )
        this.dispatch('adTimeUpdate', {
            adBreak: adState.parentBreak.adBreak,
            ad,
            index: adState.index,
            totalAds: adState.totalAds,
            adCurrentTime: adPlayed,
            adTimeRemaining:
                adTotal != null ? Math.max(0, adTotal - adPlayed) : null,
            breakCurrentTime: breakPlayed,
            breakTimeRemaining:
                breakTotal != null
                    ? Math.max(0, breakTotal - breakPlayed)
                    : null,
            canSkip,
            skipIn,
        })
    }

    /**
     * Ads breaks can have a playout limit that may cut off ad playback.
     * End the ad if that limit is reached.
     */
    private enforcePlayoutLimits(adState: AdState): void {
        const pC = this.deps.playbackController
        const { ad, parentBreak } = adState
        // Enforce playout limits independent of a finite content duration so
        // live ads with a declared playout limit are still bounded.
        if (adState.started) {
            const elapsed = Math.max(0, pC.currentTime - adState.timeStart)
            const adBreak = parentBreak.adBreak
            const limit = adBreak.playoutLimit
            if (
                limit != null &&
                parentBreak.playoutElapsed + elapsed >= limit
            ) {
                // The break's total playout limit is reached: end the whole
                // break, dropping any ads that have not started.
                parentBreak.clear()
                this.endAd(adState)
            } else if (ad.duration != null && elapsed >= ad.duration) {
                // This ad reached its declared duration: advance to the next.
                this.endAd(adState)
            }
        }
    }

    private setPendingBreaks(newPending: AdBreakList): void {
        this.pendingAdBreaks = newPending.filter(
            (adBreak) => !this.isBreakSuppressed(adBreak)
        )
        const n = this.pendingAdBreaks.length
        logDebug(
            this,
            `setPendingBreaks len=${n}, suppressed=${newPending.length - n}`
        )
        this.nextAdOrBreak()
    }

    skipAd(): void {
        this.completeAd(this.adState, 'skipped')
        this.nextAdOrBreak()
    }

    failAd(error: Error): void {
        const adState = this.adState
        if (adState) {
            // Capture the failing ad before completeAd() clears it, so the
            // adError event can distinguish an individual-ad failure from an
            // ad-list load failure (currentAd == null).
            this.completeAd(adState, 'error')
            this.dispatch('adError', {
                error,
                adBreak: adState.parentBreak.adBreak,
                currentAd: adState.ad,
            })
        }
        this.nextAdOrBreak()
    }

    private endAd(adState: AdState): void {
        this.completeAd(adState, 'ended')
        this.dispatch('adEnded', createAdProgressEvent(adState))
        this.nextAdOrBreak()
    }

    get disposed(): boolean {
        return this.disposer.disposed
    }

    /**
     * Disposes this controller, removes all listeners.
     */
    dispose(): void {
        super.dispose()
        // Tear down the ads-provider subscription so a late adsChange can't
        // re-run ad discovery (and log) after dispose.
        this.adsProviderSub?.()
        this.disposer.dispose()
        // Detach any active break so currentAd/currentAdBreak read null after
        // dispose, even if a break's ad list resolves late (startAd is already
        // guarded by the disposed check, so no adEntered/adPlaying fires).
        this.adBreakState = null
    }
}

function createAdProgressEvent(adState: AdState): AdProgressEvent {
    return {
        adBreak: adState.parentBreak.adBreak,
        ad: adState.ad,
        // Snapped to nearest 0.1 to avoid ~1.0
        playbackRateAvg: roundToNearest(adState.playbackRateAvg, 0.1),
        index: adState.index,
        totalAds: adState.totalAds,
    }
}

function createAdBreakState(adBreak: AdBreakInfo): AdBreakState {
    let _currentIndex = -1
    let _adState: AdState | null = null
    const logTarget: LogTarget = {
        logPrefix: createLogPrefix('AdBreakState'),
    }

    const adBreakState: AdBreakState = {
        adBreak,
        playoutElapsed: 0,
        completedReason: null,
        get adState(): AdState | null {
            return _adState
        },

        async nextAd(): Promise<AdState | null> {
            const ads = await getAds()
            if (_currentIndex >= ads.length) return null
            _adState = getElementOrDefault(ads, ++_currentIndex, null)
            return _adState
        },

        clear() {
            _adState = null
            _currentIndex = Number.MAX_VALUE
        },
    }

    const getAds = memoize(() => {
        logVerbose(
            logTarget,
            `requesting ads for break ${adBreak.placement} ${adBreak.id}`
        )
        return resolveValueProvider(adBreak.ads).then((ads) => {
            logVerbose(logTarget, 'ads resolved', ads)
            return ads.map((adInfo, index) => {
                return createAdState({
                    adBreakState: adBreakState,
                    ad: adInfo,
                    totalAds: ads.length,
                    index: index,
                })
            })
        })
    })

    return adBreakState
}

function createAdState({
    adBreakState,
    ad,
    totalAds,
    index,
}: {
    adBreakState: AdBreakState
    ad: AdInfo
    totalAds: number
    index: number
}): AdState {
    return {
        parentBreak: adBreakState,
        ad,
        index,
        totalAds,
        started: false,
        timeStart: 0,
        playbackRateAvg: 0,
        dataPoints: 0,
        quartile: {
            first: false,
            midpoint: false,
            third: false,
        },
        completedReason: null,
    }
}

type AdBreakKey = string & { readonly __adBreakKey: unique symbol }

/** Combines the placement and id of the break for unique reference by placement */
function adBreakKey(adBreak: AdBreakInfo): AdBreakKey {
    return `${adBreak.placement}_${adBreak.id}` as AdBreakKey
}
