/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    AbrStrategy,
    type AdBreakInfo,
    type AdBreakList,
    createVinylPlayer,
    type DrmOptions,
    inferTrackTypeFromUrl,
    type MediaQualityMetadata,
    type SeekRange,
    type TextTrackInfo,
    type TrackConfigOptions,
    HtmlTextTrackRenderer,
} from '@amazon/vinyl'
import { data } from '@amazon/vinyl-observable'
import { toast, toastError } from './components/toast'
import { onAny } from '@amazon/vinyl-util'
import { initializeLogging } from './initializeLogging'
import { handleError } from './errorHandler'

initializeLogging()

interface AdEventIndex {
    readonly index: number
    readonly totalAds: number
}

const noAds: AdEventIndex = {
    index: -1,
    totalAds: 0,
}

const media = document.createElement('video')
media.playsInline = true

// HTML caption renderer, mounted over the video by the transport (see
// TransportBar). Painting captions ourselves lets us place them in the free
// space above the controls rather than relying on native ::cue rendering.
export const captionRenderer = new HtmlTextTrackRenderer()

const player = createVinylPlayer({ media, textTrackRenderer: captionRenderer })
player.configure({
    abr: {
        strategy: AbrStrategy.BEST,
    },
})

// The player's per-track load options (a union of the registered track types).
type PlayerLoadOptions = Parameters<typeof player.load>[0]

// Observables for Vinyl State to use in TSX bindings.
export const playerState = {
    player,
    media,
    track$: data<DemoTrack | null>(null),
    hasVideo$: data(false),
    paused$: data(true),
    currentTime$: data(0),
    currentTimePercent$: data(0),
    duration$: data(0),
    fetchedTimePercent$: data(0),
    seeking$: data(false),
    loading$: data(true),
    volume$: data(player.volume),
    muted$: data(player.muted),
    textTracks$: data<readonly TextTrackInfo[]>([]),
    activeTextTrack$: data<TextTrackInfo | null>(null),
    currentAdBreak$: data<AdBreakInfo | null>(null),
    currentAdIndex$: data<AdEventIndex>(noAds),
    adBreaks$: data<AdBreakList>([]),
    adTimeRemaining$: data(0),
    canSkipAd$: data(false),
    skipIn$: data<number | null>(null),
    seekRange$: data<SeekRange | null>(null),
    // Unfiltered qualities (before any preferredAudioLanguage / resolution
    // filtering) so the settings menu can list every audio language and video
    // resolution regardless of the current selection.
    qualitiesUnfiltered$: data<readonly MediaQualityMetadata[]>([]),
    playbackRate$: data(player.playbackRate),
    // Mirrors the corresponding player options so the settings menu reflects the
    // active selection. Updated via the setters below. `audio.selection.language`
    // may be an ordered list; the settings menu only ever sets a single tag, so a
    // non-string value (an array or null) is treated as "no single preference"
    // for display purposes.
    preferredAudioLanguage$: data<string | null>(
        typeof player.options.audio.selection?.language === 'string'
            ? player.options.audio.selection.language
            : null
    ),
    // Mirrors the `audio.selection.descriptive` option: whether to select
    // audio-description (described-video) renditions.
    preferDescriptiveAudio$: data<boolean>(
        player.options.audio.selection?.descriptive ?? false
    ),
    maxVideoHeight$: data<number | null>(player.options.abr.maxHeight ?? null),
}

// Safari's loadedMetadata fires before videoWidth is populated for HLS; the
// `resize` event covers that case (and any later dimension change).
const updateHasVideo = () => {
    playerState.hasVideo$.value =
        media.videoWidth > 0 || player.contentTypes.has('video')
}
onAny(
    player,
    ['loadedMetadata', 'resize', 'contentTypesChange'],
    updateHasVideo
)

// Paused when the element is paused or ended. `ended` is not guaranteed to be
// preceded by `pause` (e.g. a postroll playing to its end), so listen for it too.
const refreshPaused = () => {
    playerState.paused$.value = player.paused || player.ended
}
onAny(player, ['play', 'played', 'pause'], refreshPaused)

player.on('timeUpdate', () => {
    playerState.currentTime$.value = player.currentTime
    playerState.currentTimePercent$.value = player.currentTimePercent
})
player.on('durationChange', ({ current }) => {
    playerState.duration$.value = current
    playerState.currentTimePercent$.value = player.currentTimePercent
})
player.on('error', ({ error }) => {
    toastError(error.message || 'Playback error')
})
player.on('fetchedRangesChange', () => {
    playerState.fetchedTimePercent$.value = player.fetchedTimePercent
})
player.on('seeking', () => {
    playerState.seeking$.value = true
})
onAny(player, ['seeked', 'emptied'], () => {
    playerState.seeking$.value = false
})
player.on('readyStateChange', () => {
    playerState.loading$.value = !player.canPlayThrough
})
player.on('volumeChange', ({ current }) => {
    playerState.volume$.value = current
})
player.on('mutedChange', ({ current }) => {
    playerState.muted$.value = current
})
player.on('textTracksChange', ({ current }) => {
    playerState.textTracks$.value = current
})
player.on('activeTextTrackChange', ({ current }) => {
    playerState.activeTextTrack$.value = current
})

onAny(player, ['trackActivated', 'trackDeactivated'], () => {
    playerState.activeTextTrack$.value = player.activeTextTrack
    playerState.qualitiesUnfiltered$.value = player.qualitiesUnfiltered ?? []
})
player.on('currentTrackAdsChange', ({ current }) => {
    playerState.adBreaks$.value = current?.adBreaks ?? []
})

player.on('adEntered', (event) => {
    // Set the ad break on an adEntered event instead of adBreakEntered
    // This avoids an ad overlay flash if there were no ads in the break.
    playerState.currentAdBreak$.value = event.adBreak
    playerState.currentAdIndex$.value = {
        index: event.index,
        totalAds: event.totalAds,
    }
})

player.on('adBreakCompleted', () => {
    playerState.currentAdBreak$.value = null
})

player.on('seekRangeChange', ({ current }) => {
    playerState.seekRange$.value = current
})

player.on('rateChange', ({ current }) => {
    playerState.playbackRate$.value = current
})

player.on('qualitiesUnfilteredChange', ({ current }) => {
    playerState.qualitiesUnfiltered$.value = current
})

// Ad timing (and the skip window) come straight from the ad controller, which
// knows the ad and break durations, rather than being derived from the media
// element's duration.
player.on('adTimeUpdate', ({ adTimeRemaining, canSkip, skipIn }) => {
    playerState.adTimeRemaining$.value = adTimeRemaining ?? 0
    playerState.canSkipAd$.value = canSkip
    playerState.skipIn$.value = skipIn
})

export type TrackType = 'dash' | 'hls' | 'src'

/**
 * Display-only metadata carried on a load's `config.extra`, so the queue view
 * can label items (which are the raw {@link @amazon/vinyl!TrackLoadOptions},
 * not this website's `DemoTrack`).
 */
export interface TrackDisplayInfo {
    readonly title?: string
    readonly description?: string
    readonly contentType?: 'video' | 'audio'
}

/**
 * A track in the player demo. `config` carries the player's per-track
 * {@link @amazon/vinyl!TrackConfigOptions} — notably `drm` (a full
 * {@link @amazon/vinyl!DrmOptions} that can configure every key system), plus
 * `startTime` and `extra` — set on a demo track or from the track settings UI.
 * Named to avoid colliding with `@amazon/vinyl`'s `Track`.
 */
export interface DemoTrack {
    readonly url: string
    readonly type: TrackType
    readonly title?: string
    readonly description?: string
    readonly contentType?: 'video' | 'audio'
    readonly config?: TrackConfigOptions
}

/**
 * Converts a website {@link DemoTrack} into the player's {@link @amazon/vinyl!TrackLoadOptions}.
 * The per-track `config` (drm, startTime, existing extra) is forwarded, and the
 * display fields are stashed on `config.extra` so the queue view can render
 * them.
 */
function toLoadOptions(track: DemoTrack): PlayerLoadOptions {
    const displayInfo: TrackDisplayInfo = {
        ...(track.title != null && { title: track.title }),
        ...(track.description != null && { description: track.description }),
        ...(track.contentType != null && { contentType: track.contentType }),
    }
    const config: TrackConfigOptions = {
        ...track.config,
        extra: { ...track.config?.extra, ...displayInfo },
    }
    return { type: track.type, uri: track.url, config }
}

export function loadContent(track: DemoTrack) {
    playerState.track$.value = track
    playerState.hasVideo$.value = track.contentType === 'video'
    player.load(toLoadOptions(track))
    player.play().catch(handleError)
}

export interface CreateTrackOptions {
    /** Overrides the inferred track type. `'auto'` (or unset) infers from the URL. */
    readonly type?: TrackType | 'auto'
    readonly title?: string
    /** Full DRM configuration (may target one or many key systems). */
    readonly drm?: Partial<DrmOptions>
}

export async function createTrackFromUrl(
    url: string,
    options?: CreateTrackOptions
): Promise<DemoTrack | null> {
    if (!url) return null
    const type =
        options?.type && options.type !== 'auto'
            ? options.type
            : await inferTrackTypeFromUrl(url)
    if (!type) return null
    return {
        url,
        type,
        ...(options?.title && { title: options.title }),
        ...(options?.drm && { config: { drm: options.drm } }),
    }
}

/**
 * Adds a track to the play queue. With nothing loaded there is no queue to add
 * to yet, so playback simply starts; otherwise the track plays after the
 * current one (and anything already queued) finishes.
 */
export function enqueueContent(track: DemoTrack) {
    if (playerState.track$.value == null) {
        loadContent(track)
        return
    }
    player.enqueue(toLoadOptions(track))
    toast(`Queued ${track.title ?? track.url}`)
}

export function togglePlayPause() {
    if (player.paused) {
        player.play().catch(handleError)
    } else {
        player.pause()
    }
}

/**
 * Seeks to a fraction of the duration.
 * @param pct A 0-1 value where 1 is duration
 */
export function seekToPercent(pct: number): Promise<void> {
    return player.seekTo(pct * player.duration).catch(handleError)
}

export function skipAd() {
    player.skipAd()
}

export function unloadTrack() {
    player.pause()
    player.unload()
    playerState.track$.value = null
    playerState.hasVideo$.value = false
}

/** Sets the playback speed (e.g. 1 for normal, 1.5 for 1.5x). */
export function setPlaybackRate(rate: number) {
    player.playbackRate = rate
    playerState.playbackRate$.value = player.playbackRate
}

/**
 * Sets the preferred audio language (an RFC 5646 tag such as 'en' or 'ja'), or
 * null for no preference. A single string tag is forward-compatible with the
 * widened `string | readonly string[] | null` form of this option.
 */
export function setPreferredAudioLanguage(language: string | null) {
    player.configure({
        audio: {
            selection: { ...player.options.audio.selection, language },
        },
    })
    playerState.preferredAudioLanguage$.value = language
}

/**
 * Selects a caption track, or turns captions off with `null`. Selection is
 * declarative via the `text` option: the filters are derived from the chosen
 * track's own attributes (language, forced, kind), so the choice carries across
 * track changes and re-resolves against whatever the next source exposes.
 */
export function selectTextTrack(track: TextTrackInfo | null) {
    if (track == null) {
        player.configure({ text: { ...player.options.text, enabled: 'off' } })
        return
    }
    player.configure({
        text: {
            enabled: 'on',
            selection: {
                language: track.language,
                forced: track.forced,
                kind: track.kind,
            },
        },
    })
}

/**
 * Opts in/out of audio-description (described-video) audio renditions. When on,
 * the player selects a description rendition where one exists for the current
 * language instead of the main audio.
 */
export function setPreferDescriptiveAudio(on: boolean) {
    player.configure({
        audio: {
            selection: { ...player.options.audio.selection, descriptive: on },
        },
    })
    playerState.preferDescriptiveAudio$.value = on
}

/**
 * Sets the maximum selectable video height in pixels (a resolution cap), or
 * null for no cap. Mirrors Shaka's `restrictions.maxHeight`.
 */
export function setMaxVideoHeight(maxHeight: number | null) {
    player.configure({ abr: { ...player.options.abr, maxHeight } })
    playerState.maxVideoHeight$.value = maxHeight
}
