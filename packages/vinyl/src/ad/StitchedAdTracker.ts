/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createDisposer,
    lerp,
    logDebug,
    logError,
    type LogTarget,
    resolveValueProvider,
    roundToNearest,
} from '@amazon/vinyl-util'
import type { AdBreakInfo, AdBreakList, AdInfo, AdList } from './AdBreakInfo'
import type {
    AdChangeReason,
    AdEventMap,
    AdProgressEvent,
} from './AdController'
import type { ReadonlyPlaybackController } from '../playback/ReadonlyPlaybackController'
import type { PlaybackController } from '../playback/PlaybackController'
import { AD_START_TOLERANCE } from './AdControllerImpl'

/**
 * How far past an ad's or break's end, in seconds, the playhead may land and
 * still count as having played through it rather than having jumped past it.
 */
const PLAY_THROUGH_TOLERANCE = 1

export interface StitchedAdTrackerDeps {
    readonly playbackController: ReadonlyPlaybackController &
        Pick<PlaybackController, 'seekTo'>
    readonly dispatch: <K extends keyof AdEventMap>(
        type: K,
        event: AdEventMap[K]
    ) => void
    readonly logTarget: LogTarget

    /**
     * False while an interstitial break owns playback, during which the
     * playback events are the interstitial's, not the content's.
     */
    readonly contentActive: () => boolean
}

interface StitchedAdState {
    readonly ad: AdInfo
    readonly index: number
    readonly totalAds: number
    /** The fraction of the ad already played when it was entered. */
    readonly entryProgress: number
    started: boolean
    playbackRateAvg: number
    dataPoints: number
    readonly quartile: { first: boolean; midpoint: boolean; third: boolean }
}

interface StitchedBreakState {
    readonly adBreak: AdBreakInfo
    readonly ads: AdList
    adState: StitchedAdState | null
}

/**
 * Tracks the stitched (SSAI) ad breaks of the content as it plays through
 * them, emitting the same ad events as interstitial breaks.
 *
 * A stitched break's ads are part of the content's media timeline, so nothing
 * is loaded or switched: the break containing the playhead is the current
 * break, and the ad containing the playhead is the current ad. Playing across
 * an ad's end ends it; seeking out of an ad or break completes it as
 * `skipped`. Seeking back into a break enters it again.
 */
export class StitchedAdTracker {
    private breaks: AdBreakList = []
    // Resolved ads by break key; discovery may return equal breaks as new
    // objects on each read.
    private readonly resolvedAds = new Map<
        string,
        { readonly adBreak: AdBreakInfo; readonly ads: AdList }
    >()
    private state: StitchedBreakState | null = null
    private lastTime = 0
    private seeking = false
    private readonly disposer = createDisposer()

    constructor(private readonly deps: StitchedAdTrackerDeps) {
        const { add } = this.disposer
        const { playbackController } = deps
        add(
            playbackController.on('seeking', () => {
                this.seeking = true
            })
        )
        add(
            playbackController.on('seeked', () => {
                this.seeking = false
                if (deps.contentActive()) this.update(/* jumped */ true)
            })
        )
        add(
            playbackController.on('playing', () => {
                const adState = this.state?.adState
                if (adState && deps.contentActive())
                    this.startAd(this.state!, adState)
            })
        )
        add(
            playbackController.on('ended', () => {
                const state = this.state
                if (state && deps.contentActive()) this.complete(state, 'ended')
            })
        )
    }

    get currentAdBreak(): AdBreakInfo | null {
        return this.state?.adBreak ?? null
    }

    get currentAd(): AdInfo | null {
        return this.state?.adState?.ad ?? null
    }

    /**
     * Sets the stitched breaks of the current content, completing an active
     * break with `contentChange` if it is no longer present.
     */
    setBreaks(breaks: AdBreakList): void {
        this.breaks = breaks
        const keys = new Set(breaks.map(breakKey))
        if (this.state && !keys.has(breakKey(this.state.adBreak))) {
            this.complete(this.state, 'contentChange')
        }
        for (const key of this.resolvedAds.keys()) {
            if (!keys.has(key)) this.resolvedAds.delete(key)
        }
        for (const adBreak of breaks) {
            const key = breakKey(adBreak)
            if (this.resolvedAds.has(key)) continue
            resolveValueProvider(adBreak.ads)
                .then((ads) => {
                    if (this.disposed || !this.breaks.includes(adBreak)) return
                    this.resolvedAds.set(key, { adBreak, ads })
                    this.update(/* jumped */ false)
                })
                .catch((error) => {
                    logError(
                        this.deps.logTarget,
                        `stitched break ${adBreak.id} ads failed to resolve`,
                        error
                    )
                })
        }
    }

    /**
     * Completes the break and its current ad with the given reason.
     */
    private complete(state: StitchedBreakState, reason: AdChangeReason): void {
        if (state.adState) this.completeAd(state, state.adState, reason)
        this.completeBreak(
            state,
            reason,
            this.deps.playbackController.currentTime
        )
    }

    /**
     * Updates the current break and ad from the playhead. Call on each time
     * update while content (not an interstitial) is playing.
     */
    onTimeUpdate(): void {
        if (this.seeking) return
        this.update(/* jumped */ false)
    }

    /**
     * Skips the current ad by seeking to its end.
     * Returns false when no stitched ad is active.
     */
    skipAd(): boolean {
        const state = this.state
        const adState = state?.adState
        if (!state || !adState) return false
        this.completeAd(state, adState, 'skipped')
        const { ad } = adState
        const end =
            ad.duration != null
                ? ad.startTime + ad.duration
                : breakEnd(state.adBreak)
        this.seekTo(end)
        return true
    }

    /**
     * Skips the rest of the current break by seeking to its end.
     * Returns false when no stitched break is active.
     */
    skipAdBreak(): boolean {
        const state = this.state
        if (!state) return false
        const end = breakEnd(state.adBreak)
        this.complete(state, 'skipped')
        this.seekTo(end)
        return true
    }

    private seekTo(time: number): void {
        if (!Number.isFinite(time)) return
        // Ignore time updates from before the seek lands.
        this.seeking = true
        this.deps.playbackController.seekTo(time).catch((error) => {
            this.seeking = false
            logDebug(this.deps.logTarget, 'stitched skip seek failed', error)
        })
    }

    private update(jumped: boolean): void {
        const pC = this.deps.playbackController
        const time = pC.currentTime
        const previousTime = this.lastTime
        this.lastTime = time
        const playedThrough = (end: number) =>
            !jumped &&
            time >= previousTime &&
            time - end < PLAY_THROUGH_TOLERANCE
        const found = this.findBreak(time)
        const resolved = found ? this.resolvedAds.get(breakKey(found)) : null
        let state = this.state
        if (state && (!found || breakKey(state.adBreak) !== breakKey(found))) {
            const end = breakEnd(state.adBreak)
            const reason = playedThrough(end) ? 'ended' : 'skipped'
            if (state.adState) this.completeAd(state, state.adState, reason)
            this.completeBreak(state, reason, time)
            state = null
        }
        if (!resolved) return // Entered once its ads resolve.
        const { adBreak, ads } = resolved
        if (!state) {
            state = { adBreak, ads, adState: null }
            this.state = state
            logDebug(this.deps.logTarget, 'stitched adBreakEntered', adBreak.id)
            this.deps.dispatch('adBreakEntered', { adBreak })
        }
        const index = findAdIndex(ads, time)
        const current = state.adState
        if (current && (index === -1 || ads[index] !== current.ad)) {
            const { ad } = current
            // An open-ended ad is only left by seeking back before it.
            const end = ad.duration != null ? ad.startTime + ad.duration : time
            this.completeAd(
                state,
                current,
                playedThrough(end) ? 'ended' : 'skipped'
            )
        }
        if (index !== -1 && !state.adState) {
            const ad = ads[index]
            const adState: StitchedAdState = {
                ad,
                index,
                totalAds: ads.length,
                entryProgress: adProgress(ad, time),
                started: false,
                playbackRateAvg: pC.playbackRate,
                dataPoints: 1,
                quartile: { first: false, midpoint: false, third: false },
            }
            state.adState = adState
            logDebug(this.deps.logTarget, 'stitched adEntered', ad.id)
            this.deps.dispatch('adEntered', adEvent(state, adState))
            if (pC.playing) this.startAd(state, adState)
        }
        if (state.adState) this.emitProgress(state, state.adState)
    }

    private startAd(state: StitchedBreakState, adState: StitchedAdState): void {
        adState.started = true
        this.deps.dispatch('adPlaying', adEvent(state, adState))
    }

    private emitProgress(
        state: StitchedBreakState,
        adState: StitchedAdState
    ): void {
        const pC = this.deps.playbackController
        const time = pC.currentTime
        const { ad } = adState
        const { adBreak } = state
        const adCurrentTime = Math.max(0, time - ad.startTime)
        const breakCurrentTime = Math.max(0, time - adBreak.startTime)
        const canSkip = adBreak.restrict.skip !== true
        this.deps.dispatch('adTimeUpdate', {
            ...adEvent(state, adState),
            adCurrentTime,
            adTimeRemaining:
                ad.duration != null
                    ? Math.max(0, ad.duration - adCurrentTime)
                    : null,
            breakCurrentTime,
            breakTimeRemaining:
                adBreak.duration != null
                    ? Math.max(0, adBreak.duration - breakCurrentTime)
                    : null,
            canSkip,
            skipIn: null,
        })
        if (!adState.started) return
        adState.dataPoints++
        adState.playbackRateAvg = lerp(
            adState.playbackRateAvg,
            pC.playbackRate,
            1 / adState.dataPoints
        )
        this.emitQuartiles(state, adState, adProgress(ad, time))
    }

    /**
     * Emits the quartiles reached at the given progress. Quartiles count only
     * when the ad was entered before them.
     */
    private emitQuartiles(
        state: StitchedBreakState,
        adState: StitchedAdState,
        progress: number
    ): void {
        const { quartile, entryProgress } = adState
        if (
            !quartile.first &&
            progress > 0.25 &&
            entryProgress < AD_START_TOLERANCE
        ) {
            quartile.first = true
            this.deps.dispatch('adFirstQuartile', progressEvent(state, adState))
        }
        if (
            !quartile.midpoint &&
            progress > 0.5 &&
            entryProgress < 0.25 + AD_START_TOLERANCE
        ) {
            quartile.midpoint = true
            this.deps.dispatch('adMidpoint', progressEvent(state, adState))
        }
        if (
            !quartile.third &&
            progress > 0.75 &&
            entryProgress < 0.5 + AD_START_TOLERANCE
        ) {
            quartile.third = true
            this.deps.dispatch('adThirdQuartile', progressEvent(state, adState))
        }
    }

    private completeAd(
        state: StitchedBreakState,
        adState: StitchedAdState,
        reason: AdChangeReason
    ): void {
        state.adState = null
        logDebug(
            this.deps.logTarget,
            `stitched adCompleted id=${adState.ad.id} reason=${reason}`
        )
        if (reason === 'ended') {
            // Time updates are coarse; report quartiles passed since the last.
            if (adState.started) this.emitQuartiles(state, adState, 1)
            this.deps.dispatch('adEnded', progressEvent(state, adState))
        }
        this.deps.dispatch('adCompleted', {
            ...adEvent(state, adState),
            reason,
        })
    }

    private completeBreak(
        state: StitchedBreakState,
        reason: AdChangeReason,
        time: number
    ): void {
        this.state = null
        const { adBreak } = state
        // Content continues from wherever the playhead is; after playing
        // through, that is the break's end.
        const resumePosition =
            reason === 'ended' ? Math.max(time, breakEnd(adBreak)) : time
        logDebug(
            this.deps.logTarget,
            `stitched adBreakCompleted id=${adBreak.id} reason=${reason}`
        )
        this.deps.dispatch('adBreakCompleted', {
            adBreak,
            resumePosition: Number.isFinite(resumePosition)
                ? resumePosition
                : time,
            reason,
        })
    }

    private findBreak(time: number): AdBreakInfo | null {
        for (const adBreak of this.breaks) {
            if (time >= adBreak.startTime && time < breakEnd(adBreak))
                return adBreak
        }
        return null
    }

    get disposed(): boolean {
        return this.disposer.disposed
    }

    dispose(): void {
        this.disposer.dispose()
        this.state = null
        this.resolvedAds.clear()
    }
}

function breakKey(adBreak: AdBreakInfo): string {
    return `${adBreak.placement}_${adBreak.id}`
}

function breakEnd(adBreak: AdBreakInfo): number {
    return adBreak.duration != null
        ? adBreak.startTime + adBreak.duration
        : Infinity
}

function findAdIndex(ads: AdList, time: number): number {
    return ads.findIndex(
        (ad) =>
            time >= ad.startTime &&
            (ad.duration == null || time < ad.startTime + ad.duration)
    )
}

function adProgress(ad: AdInfo, time: number): number {
    if (ad.duration == null || ad.duration <= 0) return 0
    return Math.max(0, (time - ad.startTime) / ad.duration)
}

function adEvent(state: StitchedBreakState, adState: StitchedAdState) {
    return {
        adBreak: state.adBreak,
        ad: adState.ad,
        index: adState.index,
        totalAds: adState.totalAds,
    }
}

function progressEvent(
    state: StitchedBreakState,
    adState: StitchedAdState
): AdProgressEvent {
    return {
        ...adEvent(state, adState),
        // Snapped to nearest 0.1 to avoid ~1.0
        playbackRateAvg: roundToNearest(adState.playbackRateAvg, 0.1),
    }
}
