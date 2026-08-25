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
    captionsEnabled$: data(false),
    preferredTextTrack$: data<CaptionPreference | null>(null),
    currentAdBreak$: data<AdBreakInfo | null>(null),
    currentAdIndex$: data<AdEventIndex>(noAds),
    adBreaks$: data<AdBreakList>([]),
    adTimeRemaining$: data(0),
    canSkipAd$: data(false),
    skipIn$: data<number | null>(null),
    seekRange$: data<SeekRange | null>(null),
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
    applyCaptionsPreference()
})
player.on('activeTextTrackChange', ({ current }) => {
    playerState.activeTextTrack$.value = current
})

player.on('currentTrackChange', () => {
    playerState.activeTextTrack$.value = player.activeTextTrack
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

// Ad timing (and the skip window) come straight from the ad controller, which
// knows the ad and break durations, rather than being derived from the media
// element's duration.
player.on('adTimeUpdate', ({ adTimeRemaining, canSkip, skipIn }) => {
    playerState.adTimeRemaining$.value = adTimeRemaining ?? 0
    playerState.canSkipAd$.value = canSkip
    playerState.skipIn$.value = skipIn
})

/**
 * The identity used to re-select the user's chosen caption track across track
 * changes. Language alone is ambiguous (a language can have both a full and a
 * forced track), so `forced` and `characteristics` disambiguate same-language
 * variants — mirroring how players like Shaka key text preference off
 * language + forced + roles rather than a label string.
 */
export interface CaptionPreference {
    readonly language: string | null
    readonly forced: boolean
    readonly characteristics: readonly string[]
}

export function captionPreferenceOf(t: TextTrackInfo): CaptionPreference {
    return {
        language: t.language,
        forced: t.forced,
        characteristics: t.characteristics,
    }
}

function applyCaptionsPreference() {
    if (!playerState.captionsEnabled$.value) return
    if (player.activeTextTrack) return // already on for this track
    const target = pickPreferredTrack(playerState.textTracks$.value)
    if (target) player.setActiveTextTrack(target.id)
}

/**
 * Scores how well a track matches the preference: exact identity beats a
 * language+forced match, which beats language-only. Returns -1 for no match.
 */
function scoreMatch(t: TextTrackInfo, pref: CaptionPreference): number {
    if (t.language !== pref.language) return -1
    let score = 1 // language matches
    if (t.forced === pref.forced) score += 2
    if (sameCharacteristics(t.characteristics, pref.characteristics)) score += 1
    return score
}

function sameCharacteristics(
    a: readonly string[],
    b: readonly string[]
): boolean {
    if (a.length !== b.length) return false
    const set = new Set(a)
    return b.every((c) => set.has(c))
}

function pickPreferredTrack(
    tracks: readonly TextTrackInfo[]
): TextTrackInfo | null {
    // The identity of the chosen caption track, retained so the same variant
    // is re-selected when captions carry across a track change (e.g. off an
    // ad). Language alone is ambiguous when a language has both a full and a
    // forced track, so forced and characteristics are part of the identity.
    if (tracks.length === 0) return null
    const pref = playerState.preferredTextTrack$.value
    if (pref) {
        let best: TextTrackInfo | null = null
        let bestScore = 0
        for (const t of tracks) {
            const score = scoreMatch(t, pref)
            if (score > bestScore) {
                bestScore = score
                best = t
            }
        }
        if (best) return best
    }
    return tracks.find((t) => t.default) ?? tracks[0]
}

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
