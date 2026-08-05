/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createVinylPlayer,
    type AdBreakInfo,
    type AdInfo,
    type SeekRange,
    type TextTrackInfo,
} from '@amazon/vinyl'
import { data } from '@amazon/vinyl-observable'
import { toastError } from './components/toast'
import { onAny } from '@amazon/vinyl-util'

const media = document.createElement('video')
media.playsInline = true

const player = createVinylPlayer({ media })

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
    // The identity of the chosen caption track, retained so the same variant
    // is re-selected when captions carry across a track change (e.g. off an
    // ad). Language alone is ambiguous when a language has both a full and a
    // forced track, so forced and characteristics are part of the identity.
    preferredTextTrack$: data<CaptionPreference | null>(null),
    activeAdBreak$: data<AdBreakInfo | null>(null),
    activeAd$: data<AdInfo | null>(null),
    adBreaks$: data<readonly AdBreakInfo[]>([]),
    adRemaining$: data(0),
    seekRange$: data<SeekRange | null>(null),
}

// Safari's loadedmetadata fires before videoWidth is populated for HLS; the
// `resize` event covers that case (and any later dimension change).
const updateHasVideo = () => {
    playerState.hasVideo$.value = media.videoWidth > 0
}
media.addEventListener('loadedmetadata', updateHasVideo)
media.addEventListener('resize', updateHasVideo)

// Paused when the element is paused or ended. `ended` is not guaranteed to be
// preceded by `pause` (e.g. a postroll playing to its end), so listen for it too.
const refreshPaused = () => {
    playerState.paused$.value = player.paused || player.ended
}
onAny(player, ['play', 'pause', 'ended'], refreshPaused)

player.on('timeUpdate', () => {
    playerState.currentTime$.value = player.currentTime
    playerState.currentTimePercent$.value = player.currentTimePercent
    updateAdRemaining()
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
// Reloading the same track (or loading a cached track) may not emit a fresh
// textTracksChange because the list reference is unchanged. Poll on every
// currentTrackChange so the session's captions preference still applies.
player.on('currentTrackChange', () => {
    playerState.textTracks$.value = player.textTracks
    playerState.activeTextTrack$.value = player.activeTextTrack
    playerState.activeAdBreak$.value = player.activeAdBreak
    playerState.activeAd$.value = player.currentAd
    updateAdRemaining()
    applyCaptionsPreference()
})

player.on('adBreakChange', (event) => {
    playerState.activeAdBreak$.value = event.current
    playerState.activeAd$.value = player.currentAd
    if (event.current) {
        updateAdRemaining()
    } else {
        playerState.adRemaining$.value = 0
    }
})
player.on('adBreaksChange', ({ current }) => {
    playerState.adBreaks$.value = current
})
player.on('seekRangeChange', ({ current }) => {
    playerState.seekRange$.value = current
})

// Recomputes the seconds remaining in the active ad break from the playhead.
function updateAdRemaining() {
    const adBreak = playerState.activeAdBreak$.value
    if (!adBreak) {
        playerState.adRemaining$.value = 0
        return
    }
    const dur = player.duration
    if (!dur || !isFinite(dur)) {
        playerState.adRemaining$.value = 0
        return
    }
    playerState.adRemaining$.value = Math.max(0, dur - player.currentTime)
}

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
    player.play().catch(() => {})
}

export async function createTrackFromUrl(url: string): Promise<Track | null> {
    if (!url) return null
    const type = inferTypeFromUrl(url) ?? (await probeType(url))
    if (!type) return null
    return { url, type }
}

function inferTypeFromUrl(url: string): TrackType | null {
    if (url.endsWith('.mpd') || url.includes('.mpd?')) return 'dash'
    if (url.endsWith('.m3u8') || url.includes('.m3u8?')) return 'hls'
    if (/\.(mp3|mp4|m4a|m4v|aac|ogg|opus|wav|webm)(\?|$)/i.test(url))
        return 'src'
    return null
}

async function probeType(url: string): Promise<TrackType | null> {
    try {
        const res = await fetch(url, { method: 'HEAD' })
        if (!res.ok) return null
        const mime = (res.headers.get('content-type') ?? '').toLowerCase()
        if (mime.includes('dash+xml')) return 'dash'
        if (mime.includes('mpegurl')) return 'hls'
        if (mime.startsWith('video/') || mime.startsWith('audio/')) return 'src'
        return null
    } catch {
        return null
    }
}

export function togglePlayPause() {
    if (player.paused) {
        player.play().catch(() => {})
    } else {
        player.pause()
    }
}

/**
 * Seeks to a fraction of the duration.
 * @param pct A 0-1 value where 1 is duration
 */
export function seekToPercent(pct: number) {
    if (player.duration > 0) {
        player.seekTo(pct * player.duration).catch(() => {})
    }
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
