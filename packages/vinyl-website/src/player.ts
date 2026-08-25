/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    AbrStrategy,
    type AdBreakInfo,
    type AdBreakList,
    createVinylPlayer,
    inferTrackTypeFromUrl,
    type MediaQualityMetadata,
    type SeekRange,
    type TextTrackInfo,
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

const player = createVinylPlayer({ media })
player.configure({
    abr: {
        strategy: AbrStrategy.BEST,
    },
})

// Observables for Vinyl State to use in TSX bindings.
export const playerState = {
    player,
    media,
    track$: data<Track | null>(null),
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
    // active selection. Updated via the setters below. `preferredAudioLanguage`
    // is being widened to `string | readonly string[] | null`; the settings menu
    // only ever sets a single tag, so a non-string initial value (an array or
    // null) is treated as "no single preference" for display purposes.
    preferredAudioLanguage$: data<string | null>(
        typeof player.options.preferredAudioLanguage === 'string'
            ? player.options.preferredAudioLanguage
            : null
    ),
    // The preferred caption language (an RFC 5646 tag), or null for captions
    // off. Mirrors the `preferredTextLanguage` player option; the settings menu
    // only ever sets a single tag.
    preferredTextLanguage$: data<string | null>(
        typeof player.options.preferredTextLanguage === 'string'
            ? player.options.preferredTextLanguage
            : null
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

player.on('currentTrackChange', () => {
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

export interface Track {
    readonly url: string
    readonly type: TrackType
    readonly title?: string
    readonly description?: string
    readonly contentType?: 'video' | 'audio'
}

export function loadContent(track: Track) {
    playerState.track$.value = track
    playerState.hasVideo$.value = track.contentType === 'video'
    player.load({ type: track.type, uri: track.url })
    player.play().catch(handleError)
}

export async function createTrackFromUrl(url: string): Promise<Track | null> {
    if (!url) return null
    const type = await inferTrackTypeFromUrl(url)
    if (!type) return null
    return { url, type }
}

/**
 * Adds a track to the play queue. With nothing loaded there is no queue to add
 * to yet, so playback simply starts; otherwise the track plays after the
 * current one (and anything already queued) finishes.
 */
export function enqueueContent(track: Track) {
    if (playerState.track$.value == null) {
        loadContent(track)
        return
    }
    player.enqueue({ type: track.type, uri: track.url })
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
    player.configure({ preferredAudioLanguage: language })
    playerState.preferredAudioLanguage$.value = language
}

/**
 * Sets the preferred caption language (an RFC 5646 tag such as 'en' or 'ja'),
 * or null to turn captions off. The player selects the matching text track
 * automatically and carries the choice across track changes.
 */
export function setPreferredTextLanguage(language: string | null) {
    player.configure({ preferredTextLanguage: language })
    playerState.preferredTextLanguage$.value = language
}

/**
 * Sets the maximum selectable video height in pixels (a resolution cap), or
 * null for no cap. Mirrors Shaka's `restrictions.maxHeight`.
 */
export function setMaxVideoHeight(maxHeight: number | null) {
    player.configure({ abr: { ...player.options.abr, maxHeight } })
    playerState.maxVideoHeight$.value = maxHeight
}
