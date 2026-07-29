/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    equalDeep,
    EventHostImpl,
    logDebug,
    type Unsubscribe,
} from '@amazon/vinyl-util'
import type { AdBreakInfo, AdController, AdEventMap, AdInfo } from './AdBreak'
import type { ReadonlyPlaybackController } from '../playback/ReadonlyPlaybackController'

export interface AdControllerImplDeps {
    readonly playbackController: ReadonlyPlaybackController
}

/**
 * Provider-agnostic {@link AdController}. Holds the discovered ad breaks and
 * derives enter/exit region events from playhead time updates.
 *
 * This controller is the *model* for ad playback: it knows which breaks exist,
 * which break contains the playhead, and which ad within that break is current.
 * It does NOT create, preload, or activate any tracks — that is the
 * responsibility of the {@link TrackController}. The ad assets themselves are
 * resolved lazily via each break's {@link AdBreakInfo.ads} function, which the
 * discovery step supplies (e.g. resolving an HLS `X-ASSET-LIST` on first use).
 *
 * A break is considered active while `startTime <= currentTime < endTime`,
 * where `endTime` is `startTime + duration`. Breaks whose duration is unknown
 * (null) never mark the playhead as inside a break, since their span is not yet
 * resolved. Breaks that resolve to zero ads are skipped.
 *
 * This class contains no HLS- or DASH-specific logic; discovery code maps its
 * protocol's signals to {@link AdBreakInfo} and pushes them via
 * {@link setAdBreaks}.
 */
export class AdControllerImpl
    extends EventHostImpl<AdEventMap>
    implements AdController
{
    get [Symbol.toStringTag](): string {
        return 'AdControllerImpl'
    }

    private _adBreaks: readonly AdBreakInfo[] = []
    private _active: AdBreakInfo | null = null
    private _activeAds: readonly AdInfo[] = []
    private _activeAdIndex = 0
    private readonly _playbackController: ReadonlyPlaybackController
    private readonly _skippedBreakIds = new Set<string>()
    private readonly _timeUpdateSub: Unsubscribe

    constructor(deps: AdControllerImplDeps) {
        super()
        this._playbackController = deps.playbackController
        this._timeUpdateSub = deps.playbackController.on('timeUpdate', () => {
            this.updateTime(deps.playbackController.currentTime)
        })
    }

    get adBreaks(): readonly AdBreakInfo[] {
        return this._adBreaks
    }

    get activeAdBreak(): AdBreakInfo | null {
        return this._active
    }

    get adPlaying(): boolean {
        return this._active != null
    }

    get currentAd(): AdInfo | null {
        return this._activeAds[this._activeAdIndex] ?? null
    }

    advanceOrSkipAd(): void {
        if (!this._active) return
        logDebug(
            this,
            'advanceOrSkipAd, index:',
            this._activeAdIndex,
            '/',
            this._activeAds.length
        )
        if (this._activeAdIndex + 1 < this._activeAds.length) {
            this._activeAdIndex++
            // Re-dispatch adBreakChange (same break) so listeners pick up the
            // new current ad.
            this.dispatch('adBreakChange', {
                previous: this._active,
                current: this._active,
            })
        } else {
            this.skipAd()
        }
    }

    setAdBreaks(adBreaks: readonly AdBreakInfo[]): void {
        // Only react when the set of break ids actually changes. This keeps a
        // codec-recovery reload (which re-resolves the same manifest) from
        // disrupting an active break, while still reacting to live manifests
        // that reveal new breaks or to a genuinely new media load.
        const newIds = new Set(adBreaks.map((b) => b.id))
        const curIds = new Set(this._adBreaks.map((b) => b.id))
        if (equalDeep(newIds, curIds)) return
        logDebug(this, 'setAdBreaks', adBreaks.length, 'breaks')

        // Drop skip state for breaks that are no longer present so a new media
        // load (or id reuse) does not silently suppress its ads. Skips for
        // breaks still present are retained (e.g. a live break revealed
        // alongside one the user already skipped).
        for (const id of this._skippedBreakIds) {
            if (!newIds.has(id)) this._skippedBreakIds.delete(id)
        }

        const previous = this._adBreaks
        // Keep a stable, start-time ordering so consumers can rely on it and
        // so region lookups can assume monotonic starts.
        const sorted = [...adBreaks].sort((a, b) => a.startTime - b.startTime)
        this._adBreaks = sorted

        this.dispatch('adBreaksChange', { previous, current: sorted })

        // If the previously active break is gone, treat it as a change to null.
        if (this._active && !sorted.some((b) => b.id === this._active!.id)) {
            const previousBreak = this._active
            this._active = null
            this._activeAds = []
            this.dispatch('adBreakChange', {
                previous: previousBreak,
                current: null,
            })
        }
        // Check if the playhead is already within a break (handles prerolls and
        // cases where the timeline resolves after seeking into a break).
        if (!this._active) {
            const next = this.breakContaining(
                this._playbackController.currentTime
            )
            if (next) this.enterBreak(next)
        }
    }

    enterPostrollIfPending(): boolean {
        if (this._active) return false
        // A postroll's start time sits at (or beyond) the content's end, so the
        // playhead rarely emits a timeUpdate inside it before `ended` fires.
        // Find the first unplayed postroll and enter it directly.
        const postroll = this._adBreaks.find(
            (b) =>
                b.placement === 'postroll' &&
                b.duration != null &&
                !this._skippedBreakIds.has(b.id)
        )
        if (!postroll) return false
        this.enterBreak(postroll)
        return true
    }

    private updateTime(currentTime: number): void {
        // Don't re-evaluate while a break is active — the playhead reflects the
        // ad track's time, not the content timeline.
        if (this._active) return
        const next = this.breakContaining(currentTime)
        if (!next) return
        this.enterBreak(next)
    }

    /**
     * Enters the given break: resolves its ads, then dispatches `adBreakChange`
     * so the resolved {@link currentAd} is available to listeners. If the break
     * resolves to zero ads, it is skipped.
     */
    private enterBreak(adBreak: AdBreakInfo): void {
        this._active = adBreak
        this._activeAdIndex = 0
        this._activeAds = []
        logDebug(this, 'entering break', adBreak.id)
        adBreak
            .ads()
            .then((ads) => {
                // Guard against the playhead moving on before resolution.
                if (this._active !== adBreak) return
                if (ads.length === 0) {
                    // A break with no playable ads is skipped.
                    this.abandonEnteredBreak(adBreak)
                    return
                }
                this._activeAds = ads
                this.dispatch('adBreakChange', {
                    previous: null,
                    current: adBreak,
                })
            })
            .catch(() => {
                if (this._active !== adBreak) return
                this.abandonEnteredBreak(adBreak)
            })
    }

    /**
     * Abandons a break that was entered (via {@link enterBreak}) but resolved
     * to no playable ads. Emits `adBreakChange` to null so a listener that
     * deferred work on the enter (e.g. a postroll on content end) is released;
     * this is a no-op transition for listeners that never suspended content.
     */
    private abandonEnteredBreak(adBreak: AdBreakInfo): void {
        this._active = null
        this._activeAds = []
        this._skippedBreakIds.add(adBreak.id)
        // `previous` is null: the break's activation was never announced to
        // listeners (we only dispatch `current` once ads resolve), so this
        // reads as a no-op transition except to callers awaiting completion.
        this.dispatch('adBreakChange', { previous: null, current: null })
    }

    skipAd(): void {
        if (!this._active) return
        logDebug(this, 'skipAd', this._active.id)
        this.endActiveBreak(this._active)
    }

    skipAdBreak(): void {
        if (!this._active) return
        logDebug(this, 'skipAdBreak', this._active.id)
        this.endActiveBreak(this._active)
    }

    private endActiveBreak(previous: AdBreakInfo): void {
        this._skippedBreakIds.add(previous.id)
        this._active = null
        this._activeAds = []
        this._activeAdIndex = 0
        this.dispatch('adBreakChange', { previous, current: null })
    }

    reset(): void {
        const previous = this._active
        this._adBreaks = []
        this._active = null
        this._activeAds = []
        this._activeAdIndex = 0
        this._skippedBreakIds.clear()
        if (previous) {
            this.dispatch('adBreakChange', { previous, current: null })
        }
    }

    /**
     * Clears all state. Emits an `adBreakChange` to null if a break was active
     * so listeners observe a clean exit when the media is unloaded.
     */
    dispose(): void {
        this._timeUpdateSub()
        const active = this._active
        this._active = null
        this._activeAds = []
        this._adBreaks = []
        if (active) {
            this.dispatch('adBreakChange', { previous: active, current: null })
        }
        super.dispose()
    }

    private breakContaining(time: number): AdBreakInfo | null {
        for (const b of this._adBreaks) {
            if (b.duration == null) continue
            if (this._skippedBreakIds.has(b.id)) continue
            if (time >= b.startTime && time < b.startTime + b.duration) {
                return b
            }
        }
        return null
    }
}
