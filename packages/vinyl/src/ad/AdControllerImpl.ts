/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { equalDeep, EventHostImpl, type Unsubscribe } from '@amazon/vinyl-util'
import type { AdBreakInfo, AdController, AdEventMap, AdInfo } from './AdBreak'
import type { Track } from '../track/Track'
import type { TrackFactory, TrackLoadOptions } from '../track/TrackFactory'
import { inferTrackType } from './inferTrackType'
import type { ReadonlyPlaybackController } from '../playback/ReadonlyPlaybackController'

export interface AdControllerImplDeps {
    readonly playbackController: ReadonlyPlaybackController
    readonly trackFactory?: TrackFactory<TrackLoadOptions> | null
}

/**
 * Provider-agnostic {@link AdController}. Holds the discovered ad breaks and
 * derives enter/exit region events from playhead time updates.
 *
 * A break is considered active while `startTime <= currentTime < endTime`,
 * where `endTime` is `startTime + duration`. Breaks whose duration is unknown
 * (null) are treated as instantaneous cue points for the purpose of the
 * active-region test - they surface in {@link adBreaks} but never mark the
 * playhead as inside a break, since their span is not yet resolved.
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
    private _trackFactory: TrackFactory<TrackLoadOptions> | null
    private readonly _playbackController: ReadonlyPlaybackController
    private readonly _adTracks = new Map<string, Track>()
    private readonly _skippedBreakIds = new Set<string>()
    private _lastTime: number = 0
    private readonly _timeUpdateSub: Unsubscribe

    constructor(deps: AdControllerImplDeps) {
        super()
        this._playbackController = deps.playbackController
        this._trackFactory = deps.trackFactory ?? null
        this._timeUpdateSub = deps.playbackController.on('timeUpdate', () => {
            const time = deps.playbackController.currentTime
            this.updateTime(time)
            this.preloadUpcomingAds(time)
        })
    }

    setTrackFactory(factory: TrackFactory<TrackLoadOptions>): void {
        this._trackFactory = factory
    }

    /**
     * Returns the ad track for the given ad id, or null if no track was created.
     */
    getAdTrack(adId: string): Track | null {
        return this._adTracks.get(adId) ?? null
    }

    private _activeAdIndex = 0
    private readonly _preloadedAdIds = new Set<string>()

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
        return this._active?.ads[this._activeAdIndex] ?? null
    }

    advanceOrSkipAd(): void {
        if (!this._active) return
        if (this._activeAdIndex + 1 < this._active.ads.length) {
            this._activeAdIndex++
            // Re-dispatch adBreakChange so listeners pick up the new ad
            this.dispatch('adBreakChange', {
                previous: this._active,
                current: this._active,
            })
        } else {
            this.skipAd()
        }
    }

    setAdBreaks(adBreaks: readonly AdBreakInfo[]): void {
        const newIds = adBreaks.map((b) => b.id).join(',')
        const curIds = this._adBreaks.map((b) => b.id).join(',')
        if (newIds === curIds) return
        const previous = this._adBreaks
        // Keep a stable, start-time ordering so consumers can rely on it and
        // so region lookups can assume monotonic starts.
        const sorted = [...adBreaks].sort((a, b) => a.startTime - b.startTime)
        this._adBreaks = sorted
        this._preloadedAdIds.clear()

        // Only dispose/recreate ad tracks if there's no active break being
        // played — otherwise a re-set of the same breaks would kill the
        // currently playing ad track.
        if (!this._active || !sorted.some((b) => b.id === this._active!.id)) {
            this.disposeAdTracks()
            this.createAdTracks(sorted)
        }
        // Always fetch asset lists for breaks that need them (even if we
        // didn't recreate tracks, e.g. during preroll playback).
        for (const adBreak of sorted) {
            if (adBreak.ads.length === 0 && adBreak.assetListUrl) {
                if (!this._adTracks.has(`${adBreak.id}-0`)) {
                    this.fetchAssetList(adBreak)
                }
            }
        }

        this.dispatch('adBreaksChange', { previous, current: sorted })

        // If the previously active break is gone, treat it as a change to null.
        if (this._active && !sorted.some((b) => b.id === this._active!.id)) {
            const previous = this._active
            this._active = null
            this.dispatch('adBreakChange', { previous, current: null })
        }
        // Check if the playhead is already within a break (handles prerolls
        // and cases where the timeline resolves after seeking into a break).
        if (!this._active) {
            const time = this._playbackController.currentTime
            const next = this.breakContaining(time)
            if (next) {
                this._activeAdIndex = 0
                this._active = next
                this.dispatch('adBreakChange', {
                    previous: null,
                    current: next,
                })
            }
        }
    }

    private updateTime(currentTime: number): void {
        this._lastTime = currentTime
        // Don't re-evaluate during ad playback — the playhead reflects the
        // ad track's time, not the content timeline.
        if (this._active) return
        const next = this.breakContaining(currentTime)
        if (!next) return
        this._activeAdIndex = 0
        this._active = next
        this.dispatch('adBreakChange', { previous: null, current: next })
    }

    skipAd(): void {
        if (!this._active) return
        const previous = this._active
        this._skippedBreakIds.add(previous.id)
        this._active = null
        this.dispatch('adBreakChange', { previous, current: null })
    }

    skipAdBreak(): void {
        if (!this._active) return
        const previous = this._active
        this._skippedBreakIds.add(previous.id)
        this._active = null
        this.dispatch('adBreakChange', { previous, current: null })
    }

    /**
     * Clears all state. Emits an `adBreakChange` to null if a break was active
     * so listeners observe a clean exit when the media is unloaded.
     */
    dispose(): void {
        this._timeUpdateSub()
        const active = this._active
        this._active = null
        this._adBreaks = []
        this.disposeAdTracks()
        if (active) {
            this.dispatch('adBreakChange', { previous: active, current: null })
        }
        super.dispose()
    }

    private breakContaining(time: number): AdBreakInfo | null {
        for (const b of this._adBreaks) {
            if (b.duration == null) continue
            if (b.ads.length === 0) continue
            if (this._skippedBreakIds.has(b.id)) continue
            if (time >= b.startTime && time < b.startTime + b.duration) {
                return b
            }
        }
        return null
    }

    private createAdTracks(adBreaks: readonly AdBreakInfo[]): void {
        if (!this._trackFactory) return
        for (const adBreak of adBreaks) {
            for (const ad of adBreak.ads) {
                if (!ad.uri) continue
                const type = inferTrackType(ad.uri)
                if (!type) continue
                const track = this._trackFactory.createAdTrack({
                    type,
                    uri: ad.uri,
                })
                this._adTracks.set(ad.id, track)
            }
        }
    }


    private fetchAssetList(adBreak: AdBreakInfo): void {
        const url = adBreak.assetListUrl!
        fetch(url)
            .then((res) => res.json())
            .then((json: { ASSETS?: { URI: string; DURATION?: number }[] }) => {
                if (!json.ASSETS || !this._trackFactory) return
                const ads: AdInfo[] = json.ASSETS.map((asset, i) => ({
                    id: `${adBreak.id}-${i}`,
                    startTime: adBreak.startTime,
                    duration: asset.DURATION ?? null,
                    uri: asset.URI,
                }))
                // Mutate the break's ads array by replacing the break with
                // updated ads. Re-emit adBreaksChange so listeners pick up
                // the new ads.
                const updated = this._adBreaks.map((b) =>
                    b.id === adBreak.id ? { ...b, ads } : b
                )
                this._adBreaks = updated
                for (const ad of ads) {
                    if (!ad.uri) continue
                    const type = inferTrackType(ad.uri)
                    if (!type) continue
                    const track = this._trackFactory.createAdTrack({
                        type,
                        uri: ad.uri,
                    })
                    this._adTracks.set(ad.id, track)
                }
                this.dispatch('adBreaksChange', {
                    previous: updated,
                    current: updated,
                })
            })
            .catch(() => {})
    }

    private disposeAdTracks(): void {
        for (const track of this._adTracks.values()) {
            track.dispose()
        }
        this._adTracks.clear()
    }

    private preloadUpcomingAds(time: number): void {
        if (!this._trackFactory) return
        for (const adBreak of this._adBreaks) {
            if (time < adBreak.startTime - AD_PRELOAD_SECONDS) continue
            if (time > adBreak.startTime) continue
            for (const ad of adBreak.ads) {
                if (this._preloadedAdIds.has(ad.id)) continue
                const track = this._adTracks.get(ad.id)
                if (!track) continue
                this._preloadedAdIds.add(ad.id)
                track.preload({ prefetchPriority: 0 }, {})
            }
        }
    }
}

const AD_PRELOAD_SECONDS = 20
