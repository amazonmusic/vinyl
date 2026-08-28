/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChangeEvent } from '../event/ChangeEvent'
import type { ReadonlyEventHost } from '@amazon/vinyl-util'
import type { ObjectSchema } from '@amazon/vinyl-validation'
import {
    array,
    boolean,
    isOneOf,
    object,
    string,
} from '@amazon/vinyl-validation'

/**
 * Categorizes the role of a text track. Mirrors HTMLMediaElement.TextTrackKind.
 */
export type TextTrackKind =
    | 'subtitles'
    | 'captions'
    | 'descriptions'
    | 'chapters'
    | 'metadata'

/**
 * Identifies and describes an available text track.
 * One TextTrackInfo is produced per discovered subtitle rendition.
 */
export interface TextTrackInfo {
    /**
     * A stable, unique identifier within the current media presentation.
     */
    readonly id: string

    /**
     * The text track kind. Defaults to 'subtitles' when not otherwise specified.
     */
    readonly kind: TextTrackKind

    /**
     * The BCP 47 language tag for the cues in this track, or null if unknown.
     */
    readonly language: string | null

    /**
     * A human-readable label for the track.
     */
    readonly label: string

    /**
     * Set when the source manifest signals this track as the default selection.
     */
    readonly default: boolean

    /**
     * Whether this is a forced track: it carries essential text (e.g.
     * translations of foreign-language dialogue) meant to be shown even when
     * the user has not enabled subtitles. Two tracks may share a language and
     * differ only by this flag, so selection must distinguish them.
     */
    readonly forced: boolean

    /**
     * Media characteristics / accessibility roles describing the track, e.g.
     * `public.accessibility.transcribes-spoken-dialog` (HLS CHARACTERISTICS) or
     * a DASH role/accessibility scheme value. Empty when none are signaled.
     */
    readonly characteristics: readonly string[]

    /**
     * The full URL of the underlying text resource (typically a WebVTT file).
     */
    readonly uri: string

    /**
     * The MIME type signaled by the source manifest, when known.
     */
    readonly mimeType: string | null

    /**
     * HLS EXT-X-DEFINE variables inherited from the parent multivariant
     * playlist. Sidecar text-track media playlists commonly `IMPORT` these
     * names and reference them in segment URIs. Present only for HLS-sourced
     * tracks whose parent playlist declared any variables.
     */
    readonly variables?: Readonly<Record<string, string>>
}

/**
 * Events dispatched by a {@link TextTrackController}.
 */
export interface TextTrackEventMap {
    /**
     * Emitted when the available text tracks change.
     */
    readonly textTracksChange: ChangeEvent<readonly TextTrackInfo[]>

    /**
     * Emitted when the active text track changes.
     */
    readonly activeTextTrackChange: ChangeEvent<TextTrackInfo | null>

    /**
     * Emitted when an error occurs while loading or activating a text track.
     */
    readonly textTrackError: TextTrackErrorEvent
}

export interface TextTrackErrorEvent {
    readonly track: TextTrackInfo
    readonly error: Error
}

/**
 * Which captions render:
 * - `'off'` — nothing renders (not even forced narrative captions).
 * - `'forced'` — only forced (narrative) tracks, so nothing shows unless the
 *   content carries a forced track for the preferred language.
 * - `'on'` — the full (non-forced) subtitle track for the preferred language.
 */
export type CaptionMode = 'on' | 'off' | 'forced'

/**
 * Criteria used to pick which text track to render. Applied in priority order:
 * an explicit {@link id} wins; otherwise the best {@link language} match is
 * chosen among tracks filtered by {@link kind} and by forced-ness (from
 * {@link forced} when set, else from the controller's
 * {@link TextTrackControllerOptions.enabled} mode).
 */
export interface TextTrackSelection {
    /**
     * Selects the text track with this exact identifier, ignoring the other
     * criteria (but still gated by the `'off'` mode). If no track has this id,
     * nothing is selected.
     */
    readonly id?: string | null

    /**
     * Restricts selection to tracks of this kind (e.g. `'captions'`). Unset
     * considers all kinds.
     */
    readonly kind?: TextTrackKind | null

    /**
     * Preferred caption language(s), most-preferred first, as RFC 5646 tags.
     * When unset (or empty) selection falls back to the platform's
     * `navigator.languages`.
     */
    readonly language?: string | readonly string[] | null

    /**
     * Explicit forced-ness filter. When set, only tracks whose `forced` flag
     * equals this value are considered, overriding the forced/full split
     * implied by the `enabled` mode. Unset means the mode decides.
     */
    readonly forced?: boolean | null
}

/**
 * Declarative configuration for a {@link TextTrackController}. Rendering is
 * driven entirely by this value (via `VinylOptions.text`); there is no
 * imperative track-select call.
 */
export interface TextTrackControllerOptions {
    /**
     * Which captions render (see {@link CaptionMode}). Unset defaults to
     * `'forced'`.
     */
    readonly enabled?: CaptionMode | null

    /**
     * The selection criteria (language / id / kind). When unset, the preferred
     * languages fall back to the platform's `navigator.languages`.
     */
    readonly selection?: TextTrackSelection | null
}

const TEXT_TRACK_KINDS = [
    'subtitles',
    'captions',
    'descriptions',
    'chapters',
    'metadata',
] as const satisfies readonly TextTrackKind[]

const textTrackSelectionValidator: ObjectSchema<TextTrackSelection> = object({
    id: string().orNull().optional(),
    kind: isOneOf(...TEXT_TRACK_KINDS)
        .orNull()
        .optional(),
    language: string().or(array(string()).readonly()).orNull().optional(),
    forced: boolean().orNull().optional(),
})

export const textTrackControllerOptionsValidator: ObjectSchema<TextTrackControllerOptions> =
    object({
        enabled: isOneOf('on', 'off', 'forced').orNull().optional(),
        selection: textTrackSelectionValidator.orNull().optional(),
    })

export const ALL_TEXT_TRACK_EVENTS = [
    'textTracksChange',
    'activeTextTrackChange',
    'textTrackError',
] as const satisfies readonly (keyof TextTrackEventMap)[]

/**
 * Read-only view of available text tracks and the active selection.
 */
export interface ReadonlyTextTrackController extends ReadonlyEventHost<TextTrackEventMap> {
    /**
     * The list of currently discovered text tracks.
     */
    readonly textTracks: readonly TextTrackInfo[]

    /**
     * The currently active text track, or null if none is active.
     */
    readonly activeTextTrack: TextTrackInfo | null

    /**
     * Returns true if this text track controller is active.
     */
    get active(): boolean
}

/**
 * Full controller for the current media's text tracks. Selection is driven
 * declaratively through the controller's options (`VinylOptions.text`); this
 * interface only adds the render lifecycle used by the owning media track.
 */
export interface TextTrackController extends ReadonlyTextTrackController {
    /**
     * Suspends cue rendering without changing the active selection: cancels any
     * in-flight load and hides the DOM text track (so its cues stop showing).
     * Called when the owning media track is deactivated — e.g. while an ad
     * plays over the suspended content. {@link activate} rebuilds it.
     */
    deactivate(): void

    /**
     * Resumes rendering the active selection after a {@link deactivate},
     * reloading its cues. No-op when nothing is selected or already rendering.
     * Called when the owning media track is reactivated.
     */
    activate(): void
}
