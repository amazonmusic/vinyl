/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    Maybe,
    ReadonlyAbort,
    RequestInitOptions,
} from '@amazon/vinyl-util'
import { requestWithRetry, resolveUrl, sleep } from '@amazon/vinyl-util'
import { parseMediaPlaylist } from '@amazon/vinyl-hls-parser'
import { parseWebVtt, type WebVttCue } from './parseWebVtt'

/**
 * Seconds ahead of the playhead to keep cues buffered. Mirrors the media
 * pipeline's default HLS `minBufferTime` so captions stay in step with the
 * audio/video buffer.
 */
export const DEFAULT_TEXT_LOOK_AHEAD = 10

/**
 * Seconds behind the playhead to keep cues buffered. Small window so that a
 * short rewind (e.g. accidental skip-back) doesn't force a refetch.
 */
export const DEFAULT_TEXT_LOOK_BEHIND = 2

/**
 * Polling interval, in seconds, when no segment is currently in the buffer
 * window. Short enough to feel responsive after a seek without spinning.
 */
const IDLE_POLL_SECONDS = 0.25

export interface LoadWebVttCuesOptions {
    readonly abort?: Maybe<ReadonlyAbort>
    readonly requestInit?: Maybe<RequestInitOptions>

    /**
     * HLS EXT-X-DEFINE variables to make available for `IMPORT` and for
     * substitution of segment URIs when loading from an HLS media playlist.
     */
    readonly variables?: Maybe<Readonly<Record<string, string>>>

    /**
     * Invoked with each batch of cues as soon as they are parsed. Called once
     * per HLS segment, or once for a direct `.vtt` document.
     */
    readonly onCues: (cues: readonly WebVttCue[]) => void

    /**
     * Returns the current playback time (seconds on the presentation
     * timeline). Used to fetch caption segments in a window around the
     * playhead rather than draining the entire playlist up front.
     */
    readonly getCurrentTime: () => number

    /**
     * Seconds ahead of the playhead to keep buffered. Default 10s.
     */
    readonly lookAhead?: Maybe<number>

    /**
     * Seconds behind the playhead to keep buffered. Default 2s.
     */
    readonly lookBehind?: Maybe<number>
}

/**
 * Loads WebVTT cues from a URI, streaming them by playhead position.
 *
 * Two URI shapes are accepted:
 *  - Direct `.vtt` document: fetched once and delivered via `onCues`.
 *  - HLS media playlist (`.m3u8`): the playlist is parsed, then segments
 *    whose time range overlaps the buffer window around `getCurrentTime()`
 *    are fetched (closest to the playhead first), one at a time. Each
 *    segment's cues are delivered via `onCues` as it is parsed.
 *
 * Cue start/end times are expected to already be on the presentation
 * timeline (Shaka packager's default WebVTT output), so segments are joined
 * without offset.
 *
 * The returned promise resolves once every segment has been fetched, or the
 * abort signal fires. Fetch failures reject the promise.
 */
export async function loadWebVttCues(
    uri: string,
    options: LoadWebVttCuesOptions
): Promise<void> {
    const { abort, requestInit, variables, onCues, getCurrentTime } = options
    const lookAhead = options.lookAhead ?? DEFAULT_TEXT_LOOK_AHEAD
    const lookBehind = options.lookBehind ?? DEFAULT_TEXT_LOOK_BEHIND
    const init = requestInit ?? undefined

    if (looksLikeMediaPlaylist(uri)) {
        return streamMediaPlaylist({
            uri,
            init,
            abort,
            variables: variables ?? undefined,
            onCues,
            getCurrentTime,
            lookAhead,
            lookBehind,
        })
    }
    const response = await requestWithRetry(uri, init, { abort })
    const contentType = (
        response.headers.get('content-type') ?? ''
    ).toLowerCase()
    const body = await response.text()
    if (contentType.includes('mpegurl') || body.startsWith('#EXTM3U')) {
        return streamMediaPlaylistText({
            text: body,
            baseUrl: response.url || uri,
            init,
            abort,
            variables: variables ?? undefined,
            onCues,
            getCurrentTime,
            lookAhead,
            lookBehind,
        })
    }
    const cues = parseWebVtt(body).cues
    if (cues.length > 0) onCues(cues)
}

function looksLikeMediaPlaylist(uri: string): boolean {
    const path = uri.split(/[?#]/)[0]
    return path.toLowerCase().endsWith('.m3u8')
}

interface StreamCtx {
    readonly uri?: string
    readonly text?: string
    readonly baseUrl?: string
    readonly init: RequestInitOptions | undefined
    readonly abort: Maybe<ReadonlyAbort>
    readonly variables: Readonly<Record<string, string>> | undefined
    readonly onCues: (cues: readonly WebVttCue[]) => void
    readonly getCurrentTime: () => number
    readonly lookAhead: number
    readonly lookBehind: number
}

async function streamMediaPlaylist(ctx: StreamCtx): Promise<void> {
    const response = await requestWithRetry(ctx.uri!, ctx.init, {
        abort: ctx.abort,
    })
    const text = await response.text()
    return streamMediaPlaylistText({
        ...ctx,
        text,
        baseUrl: response.url || ctx.uri!,
    })
}

async function streamMediaPlaylistText(ctx: StreamCtx): Promise<void> {
    const playlist = parseMediaPlaylist(ctx.text!, ctx.variables)
    const segments = playlist.segments
    // Precompute each segment's [start, end] on the presentation timeline.
    const ranges: { start: number; end: number }[] = []
    let cursor = 0
    for (const seg of segments) {
        ranges.push({ start: cursor, end: cursor + seg.duration })
        cursor += seg.duration
    }
    const pending = new Set<number>(segments.map((_, i) => i))

    while (pending.size > 0 && !ctx.abort?.aborted()) {
        const idx = pickInWindow(pending, ranges, ctx)
        if (idx < 0) {
            await sleep(IDLE_POLL_SECONDS, ctx.abort).catch(() => {})
            continue
        }
        pending.delete(idx)
        const segUri = resolveUrl(segments[idx].uri, ctx.baseUrl!)
        const res = await requestWithRetry(segUri, ctx.init, {
            abort: ctx.abort,
        })
        const body = await res.text()
        const cues = parseWebVtt(body).cues
        if (cues.length > 0) ctx.onCues(cues)
    }
}

/**
 * Selects the pending segment closest to the playhead whose time range
 * overlaps [now - lookBehind, now + lookAhead]. Returns -1 when no pending
 * segment intersects the window — the caller should sleep and re-check.
 */
function pickInWindow(
    pending: ReadonlySet<number>,
    ranges: readonly { start: number; end: number }[],
    ctx: StreamCtx
): number {
    const now = ctx.getCurrentTime()
    const windowStart = now - ctx.lookBehind
    const windowEnd = now + ctx.lookAhead
    let best = -1
    let bestDist = Number.POSITIVE_INFINITY
    for (const idx of pending) {
        const r = ranges[idx]
        if (r.end < windowStart || r.start > windowEnd) continue
        const mid = (r.start + r.end) / 2
        const dist = Math.abs(mid - now)
        if (dist < bestDist) {
            bestDist = dist
            best = idx
        }
    }
    return best
}
