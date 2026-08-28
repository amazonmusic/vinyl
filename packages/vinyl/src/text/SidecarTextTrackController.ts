/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type AbortSlot,
    createAbortSlot,
    createDisposer,
    equalDeep,
    EventHostImpl,
    logError,
    type Maybe,
    type RequestInitOptions,
} from '@amazon/vinyl-util'
import type {
    TextTrackController,
    TextTrackControllerOptions,
    TextTrackEventMap,
    TextTrackInfo,
} from './TextTrack'
import { loadWebVttCues } from './SidecarTextTrackLoader'
import type { WebVttCue } from './parseWebVtt'
import type { ObservableValue } from '@amazon/vinyl-observable'
import { pickPreferredTextTrack } from './pickPreferredTextTrack'
import { applyVttCueStyle, isVttCue } from './VttCueStyle'
import type {
    MediaTextTrackProvider,
    TextTrackRef,
} from './mediaTextTrackProvider'
import type { ReadonlyPlaybackController } from '../playback/ReadonlyPlaybackController'
import type { TextTrackRenderer } from './TextTrackRenderer'

export interface SidecarTextTrackControllerDeps {
    /**
     * Hands out (memoized) DOM text tracks. Text tracks can only be created on a
     * media element and never removed, so the provider reuses one track per
     * rendition rather than accumulating them.
     */
    readonly textTrackProvider: MediaTextTrackProvider

    /**
     * Optional request init options forwarded with each VTT fetch (e.g. CORS).
     */
    readonly requestInit?: Maybe<RequestInitOptions>

    /**
     * The discovered text tracks, re-emitted whenever the manifest changes.
     */
    readonly textTracks: ObservableValue<Promise<readonly TextTrackInfo[]>>

    /**
     * Declarative selection / rendering configuration. Re-applied on change.
     */
    readonly options: ObservableValue<TextTrackControllerOptions>

    /**
     * Supplies the current playhead used to fetch caption segments in a window
     * around it.
     */
    readonly playbackController: ReadonlyPlaybackController

    /**
     * Optional renderer that paints cues itself (HTML overlay). When provided,
     * the DOM text track is kept `'hidden'` (timing only) and the renderer is
     * handed the active track; without one, the track renders natively
     * (`'showing'`).
     */
    readonly textTrackRenderer?: Maybe<TextTrackRenderer>
}

/**
 * Selects the text track that matches the given options, or null for none.
 *
 * The `enabled` mode gates everything: `'off'` renders nothing (default is
 * `'forced'`). Otherwise an explicit {@link TextTrackSelection.id} wins; else
 * the best language match is chosen among tracks filtered by kind and
 * forced-ness. Forced-ness comes from {@link TextTrackSelection.forced} when
 * set, otherwise from the mode (`'forced'` keeps only forced tracks, `'on'`
 * only full tracks).
 *
 * @private
 */
export function resolveSelectedTrack(
    tracks: readonly TextTrackInfo[],
    options: TextTrackControllerOptions
): TextTrackInfo | null {
    const mode = options.enabled ?? 'forced'
    if (mode === 'off') return null
    const selection = options.selection ?? {}
    if (selection.id != null) {
        return tracks.find((t) => t.id === selection.id) ?? null
    }
    let pool = tracks
    if (selection.kind != null) {
        pool = pool.filter((t) => t.kind === selection.kind)
    }
    // Explicit forced filter overrides the mode's forced/full split.
    const forced = selection.forced ?? mode === 'forced'
    pool = pool.filter((t) => t.forced === forced)
    // pickPreferredTextTrack falls back to navigator.languages when no language
    // preference is supplied.
    return pickPreferredTextTrack(pool, selection.language)
}

/**
 * Manages a sidecar WebVTT-based text track lifecycle:
 *
 *  - tracks the discovered {@link TextTrackInfo} list (from the `textTracks`
 *    observable) and the current selection (from the `options` observable)
 *  - on selection, fetches the chosen track's WebVTT and pushes cues to a DOM
 *    `TextTrack` obtained from the {@link MediaTextTrackProvider}
 *  - clears cues and hides the DOM track when the selection changes or clears
 *
 * The controller is agnostic of HLS/DASH discovery details; its inputs are the
 * observables supplied by the manifest layer.
 */
export class SidecarTextTrackController
    extends EventHostImpl<TextTrackEventMap>
    implements TextTrackController
{
    get [Symbol.toStringTag](): string {
        return 'SidecarTextTrackController'
    }

    // Whether the owning media track is current (rendering allowed). Toggled by
    // activate()/deactivate() across suspensions such as ad breaks.
    private _active = false

    private _tracks: readonly TextTrackInfo[] = []
    private _activeTextTrack: TextTrackInfo | null = null
    // The DOM text track currently rendering cues, or null when hidden. Owned by
    // the provider (never created/removed here).
    private _ref: TextTrackRef | null = null
    private readonly loadAbort: AbortSlot = createAbortSlot()
    private readonly disposer = createDisposer()

    constructor(private readonly deps: SidecarTextTrackControllerDeps) {
        super()
        const { add } = this.disposer
        // Both fire immediately with the current value, resolving the initial
        // track list and selection on construction.
        add(deps.options.onData(() => this.refreshSelection()))
        add(
            deps.textTracks.onData((tracksPromise) => {
                tracksPromise
                    .then((tracks) => this.setTracks(tracks))
                    .catch((error) => {
                        // Manifest errors surface through the manifest
                        // controller; just note and don't double-report.
                        logError(this, 'text tracks promise rejected', error)
                    })
            })
        )
    }

    get textTracks(): readonly TextTrackInfo[] {
        return this._tracks
    }

    get activeTextTrack(): TextTrackInfo | null {
        return this._activeTextTrack
    }

    get active(): boolean {
        return this._active
    }

    get disposed(): boolean {
        return this.disposer.disposed
    }

    /**
     * Replaces the discovered track list, emits `textTracksChange`, then
     * re-applies the current selection against the new list.
     */
    private setTracks(tracks: readonly TextTrackInfo[]): void {
        if (this.disposed) return
        const previous = this._tracks
        if (equalDeep(previous, tracks)) return
        this._tracks = tracks
        this.dispatch('textTracksChange', { previous, current: tracks })
        this.refreshSelection()
    }

    /**
     * Recomputes the selection from the current options and track list,
     * emitting `activeTextTrackChange` on change and (re)rendering when active.
     */
    private refreshSelection(): void {
        const previous = this._activeTextTrack
        const target = resolveSelectedTrack(
            this._tracks,
            this.deps.options.value
        )
        const trackChanged = target?.id !== previous?.id
        if (trackChanged) {
            this._activeTextTrack = target
            this.dispatch('activeTextTrackChange', {
                previous,
                current: target,
            })
        }
        if (!this._active) return
        // Cues carry their own authored styling, so only a track change (not a
        // same-track options change) needs a (re)load.
        if (!target) this.hideCurrent()
        else if (trackChanged || !this._ref) this.startLoad(target)
    }

    deactivate(): void {
        this._active = false
        this.hideCurrent()
    }

    activate(): void {
        this._active = true
        // Rebuild only when a selection exists and it isn't already rendering.
        if (!this._activeTextTrack || this._ref) return
        this.startLoad(this._activeTextTrack)
    }

    private startLoad(track: TextTrackInfo): void {
        // Hide the previously-rendering track (a different rendition) so its
        // cues don't linger alongside the new one; this also aborts any prior
        // in-flight load and arms a fresh abort for this one.
        this.hideCurrent()
        const abort = this.loadAbort.value
        const ref = this.deps.textTrackProvider.getOrCreate(
            track.kind,
            track.label,
            track.language ?? undefined
        )
        // With an injected renderer the browser must not paint (the renderer
        // does), but the track still needs to be active for cue timing — hence
        // 'hidden'. Without one, 'showing' uses native rendering. Set the mode
        // before clearing: `cues` reads null while disabled.
        const renderer = this.deps.textTrackRenderer
        ref.track.mode = renderer ? 'hidden' : 'showing'
        ref.clear()
        this._ref = ref
        renderer?.setTextTrack(ref.track)

        const CueCtor = getVttCueConstructor()
        // Adjacent HLS caption segments commonly repeat the boundary cue in both
        // segments (so a client that only fetches one still renders the overlap).
        // Track seen keys per active load so we don't push the same cue twice.
        const seen = new Set<string>()
        // Accumulate authored STYLE-block CSS and forward it to the renderer as
        // it arrives — only wired when the renderer can actually consume styles.
        const styles = new Set<string>()
        const setStyles = renderer?.setStyles?.bind(renderer)
        loadWebVttCues(track.uri, {
            abort,
            requestInit: this.deps.requestInit,
            variables: track.variables,
            getCurrentTime: () => this.deps.playbackController.currentTime,
            onCues: (cues) => {
                if (abort.aborted()) return
                if (CueCtor) this.appendCues(ref.track, CueCtor, cues, seen)
            },
            onStyles: setStyles
                ? (blocks) => {
                      if (abort.aborted()) return
                      for (const block of blocks) styles.add(block)
                      setStyles([...styles])
                  }
                : undefined,
        }).catch((error) => {
            if (abort.aborted()) return
            this.dispatch('textTrackError', {
                track,
                error:
                    error instanceof Error ? error : new Error(String(error)),
            })
        })
    }

    private appendCues(
        dom: TextTrack,
        CueCtor: VttCueCtor,
        cues: readonly WebVttCue[],
        seen: Set<string>
    ): void {
        for (const cue of cues) {
            const key = `${cue.startTime}|${cue.endTime}|${cue.text}`
            if (seen.has(key)) continue
            seen.add(key)
            const domCue = new CueCtor(cue.startTime, cue.endTime, cue.text)
            if (cue.id != null) domCue.id = cue.id
            // Preserve the cue's own authored WebVTT settings (position, line,
            // size, align, …). Only VTTCues carry these properties.
            if (cue.settings && isVttCue(domCue)) {
                applyVttCueStyle(domCue, cue.settings)
            }
            dom.addCue(domCue)
        }
    }

    /**
     * Clears cues from the current DOM track and hides it, keeping the track for
     * later reuse via the provider.
     */
    private hideCurrent(): void {
        // Cancel any in-flight load: its cues are no longer wanted, and a late
        // rejection must not surface as a textTrackError.
        this.loadAbort.abort()
        const ref = this._ref
        if (!ref) return
        this.deps.textTrackRenderer?.setTextTrack(null)
        ref.clear()
        ref.track.mode = 'disabled'
        this._ref = null
    }

    /**
     * Cancels any in-flight load, hides the DOM text track, and resets state.
     * Called by the host when the underlying media is unloaded.
     */
    dispose(): void {
        if (this.disposed) return
        super.dispose()
        this.loadAbort.abort()
        this.hideCurrent()
        this.disposer.dispose()
        this._tracks = []
        this._activeTextTrack = null
    }
}

interface VttCueCtor {
    new (
        start: number,
        end: number,
        text: string
    ): TextTrackCue & {
        id: string
    }
}

function getVttCueConstructor(): VttCueCtor | null {
    const g = globalThis as unknown as {
        VTTCue?: VttCueCtor
        TextTrackCue?: VttCueCtor
    }
    return g.VTTCue ?? g.TextTrackCue ?? null
}
