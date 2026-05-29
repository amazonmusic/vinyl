/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createVinylPlayer } from '@amazon/vinyl'
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
}

// Safari's loadedmetadata fires before videoWidth is populated for HLS; the
// `resize` event covers that case (and any later dimension change).
const updateHasVideo = () => {
    playerState.hasVideo$.value = media.videoWidth > 0
}
media.addEventListener('loadedmetadata', updateHasVideo)
media.addEventListener('resize', updateHasVideo)

player.on('play', () => {
    playerState.paused$.value = false
})
player.on('pause', () => {
    playerState.paused$.value = true
})

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

export function unloadTrack() {
    player.pause()
    player.unload()
    playerState.track$.value = null
    playerState.hasVideo$.value = false
}
