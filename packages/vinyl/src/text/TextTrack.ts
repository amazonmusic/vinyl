/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChangeEvent } from '../event/ChangeEvent'
import type { ReadonlyEventHost } from '@amazon/vinyl-util'

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
}

/**
 * Provides access to the text tracks of the current media and allows
 * selecting one for playback.
 *
 * Selection is persisted across track changes only when applications choose
 * to call {@link setActiveTextTrack} again on the new track. This matches
 * how audio tracks are typically driven.
 */
export interface TextTrackController extends ReadonlyTextTrackController {
    /**
     * Selects the text track with the given id, or clears the active text
     * track when called with null. No-op if the id does not match a known
     * text track.
     */
    setActiveTextTrack(id: string | null): void

    /**
     * Suspends cue rendering without changing the active selection: cancels any
     * in-flight load and tears down the DOM text track (so its cues stop
     * showing). Called when the owning media track is deactivated — e.g. while
     * an ad plays over the suspended content. {@link resume} rebuilds it.
     */
    suspend(): void

    /**
     * Rebuilds the DOM text track for the active selection after a
     * {@link suspend}, reloading its cues. No-op when nothing is active or when
     * already rendering. Called when the owning media track is reactivated.
     */
    resume(): void
}
