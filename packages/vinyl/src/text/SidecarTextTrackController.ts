/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Abort,
    equalDeep,
    EventHostImpl,
    type Maybe,
    type RequestInitOptions,
} from '@amazon/vinyl-util'
import type {
    TextTrackController,
    TextTrackEventMap,
    TextTrackInfo,
} from './TextTrack'
import { loadWebVttCues } from './SidecarTextTrackLoader'
import type { WebVttCue } from './parseWebVtt'

export interface SidecarTextTrackControllerDeps {
    /**
     * The HTML media element on which to attach the in-band TextTrack
     * representation. Cues for the active text track are added to a TextTrack
     * created via `media.addTextTrack`. Setting this to null disables DOM
     * integration; cues are still loaded and surfaced via events.
     */
    readonly media: HTMLMediaElement | null

    /**
     * Optional request init options forwarded with each VTT fetch (e.g. CORS).
     */
    readonly requestInit?: Maybe<RequestInitOptions>
}

/**
 * Manages a sidecar WebVTT-based text track lifecycle:
 *
 *  - holds a discovered list of {@link TextTrackInfo}
 *  - on activation, fetches the chosen track's WebVTT and pushes cues to a
 *    {@link TextTrack} created on the {@link HTMLMediaElement}
 *  - clears any previously activated cues when switching tracks
 *
 * The controller is intentionally agnostic of HLS/DASH discovery details. Its
 * input is whatever list of {@link TextTrackInfo} entries the manifest layer
 * decides to surface.
 */
export class SidecarTextTrackController
    extends EventHostImpl<TextTrackEventMap>
    implements TextTrackController
{
    get [Symbol.toStringTag](): string {
        return 'SidecarTextTrackController'
    }

    private _tracks: readonly TextTrackInfo[] = []
    private _active: TextTrackInfo | null = null
    private _domTrack: TextTrack | null = null
    private loadAbort: Abort | null = null

    constructor(private readonly deps: SidecarTextTrackControllerDeps) {
        super()
    }

    get textTracks(): readonly TextTrackInfo[] {
        return this._tracks
    }

    get activeTextTrack(): TextTrackInfo | null {
        return this._active
    }

    /**
     * Replaces the discovered text track list. Emits `textTracksChange`. If
     * the previously active track is no longer present, clears the active
     * selection and emits `activeTextTrackChange`.
     */
    setTextTracks(tracks: readonly TextTrackInfo[]): void {
        if (equalDeep(this._tracks, tracks)) return
        const previous = this._tracks
        this._tracks = tracks
        this.dispatch('textTracksChange', { previous, current: tracks })

        if (this._active && !tracks.some((t) => t.id === this._active!.id)) {
            this.setActiveTextTrack(null)
        }
    }

    setActiveTextTrack(id: string | null): void {
        const next = id == null ? null : this._tracks.find((t) => t.id === id)
        if (id != null && !next) return // unknown id is a no-op
        const target = next ?? null
        if (target?.id === this._active?.id) return
        const previous = this._active
        this.clearDomTrack()
        this.loadAbort?.abort()
        this.loadAbort = null
        this._active = target
        this.dispatch('activeTextTrackChange', {
            previous,
            current: target,
        })
        if (target) this.startLoad(target)
    }

    /**
     * Cancels any in-flight load, clears the DOM TextTrack, and resets state.
     * Called by the host when the underlying media is unloaded.
     */
    dispose(): void {
        super.dispose()
        this.loadAbort?.abort()
        this.loadAbort = null
        this.clearDomTrack()
        this._tracks = []
        this._active = null
    }

    private startLoad(track: TextTrackInfo): void {
        const media = this.deps.media
        // Without a media element there's nowhere to render cues and no
        // playhead to drive segment selection, so skip fetching entirely.
        // The active-selection state still surfaces via events.
        if (!media) return
        const abort = new Abort()
        this.loadAbort = abort
        // Create the DOM TextTrack up front so cues render incrementally as
        // segments arrive rather than after the whole playlist loads.
        const dom = this.ensureDomTrack(media, track)
        const CueCtor = getVttCueConstructor()
        // Adjacent HLS caption segments commonly repeat the boundary cue in
        // both segments (packagers do this so a client that only fetches one
        // segment still renders the overlapping cue). Track seen keys per
        // active load so we don't push the same cue twice.
        const seen = new Set<string>()
        loadWebVttCues(track.uri, {
            abort,
            requestInit: this.deps.requestInit,
            variables: track.variables,
            getCurrentTime: () => media.currentTime,
            onCues: (cues) => {
                if (abort.aborted()) return
                if (CueCtor) this.appendCues(dom, CueCtor, cues, seen)
            },
        }).catch((error) => {
            if (abort.aborted()) return
            this.dispatch('textTrackError', {
                track,
                error:
                    error instanceof Error ? error : new Error(String(error)),
            })
        })
    }

    private ensureDomTrack(
        media: HTMLMediaElement,
        track: TextTrackInfo
    ): TextTrack {
        const dom = media.addTextTrack(
            track.kind,
            track.label,
            track.language ?? undefined
        )
        dom.mode = 'showing'
        this._domTrack = dom
        return dom
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
            dom.addCue(domCue)
        }
    }

    private clearDomTrack(): void {
        const dom = this._domTrack
        if (!dom) return
        dom.mode = 'disabled'
        // Best-effort: remove any cues we added so a future activation starts
        // from a clean slate. Some platforms recreate the underlying TextTrack
        // when the source changes; this is defensive.
        if (dom.cues) {
            const all = Array.from(
                dom.cues as unknown as Iterable<TextTrackCue>
            )
            for (const cue of all) dom.removeCue(cue)
        }
        this._domTrack = null
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
