/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { equalDeep, EventHostImpl } from '@amazon/vinyl-util'
import type { AdBreakInfo, AdController, AdEventMap } from './AdBreak'

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

    get adBreaks(): readonly AdBreakInfo[] {
        return this._adBreaks
    }

    get activeAdBreak(): AdBreakInfo | null {
        return this._active
    }

    setAdBreaks(adBreaks: readonly AdBreakInfo[]): void {
        if (equalDeep(this._adBreaks, adBreaks)) return
        const previous = this._adBreaks
        // Keep a stable, start-time ordering so consumers can rely on it and
        // so region lookups can assume monotonic starts.
        const sorted = [...adBreaks].sort((a, b) => a.startTime - b.startTime)
        this._adBreaks = sorted
        this.dispatch('adBreaksChange', { previous, current: sorted })

        // If the previously active break is gone, treat it as a change to null.
        if (this._active && !sorted.some((b) => b.id === this._active!.id)) {
            const previous = this._active
            this._active = null
            this.dispatch('adBreakChange', { previous, current: null })
        }
    }

    updateTime(currentTime: number): void {
        const next = this.breakContaining(currentTime)
        if (next?.id === this._active?.id) return
        const previous = this._active
        this._active = next
        this.dispatch('adBreakChange', { previous, current: next })
    }

    /**
     * Clears all state. Emits an `adBreakChange` to null if a break was active
     * so listeners observe a clean exit when the media is unloaded.
     */
    dispose(): void {
        const active = this._active
        this._active = null
        this._adBreaks = []
        if (active) {
            this.dispatch('adBreakChange', { previous: active, current: null })
        }
        super.dispose()
    }

    private breakContaining(time: number): AdBreakInfo | null {
        for (const b of this._adBreaks) {
            if (b.duration == null) continue
            if (time >= b.startTime && time < b.startTime + b.duration) {
                return b
            }
        }
        return null
    }
}
