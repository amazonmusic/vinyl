/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StallDetectorOptions {
    /**
     * Called when playback resumes without emitting a `playing` event (or after the detector
     * revived it), so the caller can announce playback.
     */
    readonly fabricatePlaying: () => void
    /** Poll interval in seconds. Default: 0.25 */
    readonly pollInterval?: number
    /** Seconds the play head must be frozen before recovering. Default: 0.75 */
    readonly stallThreshold?: number
    /**
     * Don't nudge this close to the end of buffered data; a freeze there is a
     * legitimate wait for more data. Seconds. Default: 0.5
     */
    readonly bufferEndMargin?: number
    /** Seconds to nudge the play head forward to prod a resume. Default: 0.1 */
    readonly stallSkip?: number
    /** Max recovery attempts before giving up. Default: 3 */
    readonly maxAttempts?: number
    /**
     * Nudge even when the playhead isn't inside a buffered range. Some WebKit versions leave a
     * seek perpetually pending (no `seeked`) with a stale empty `buffered` even though data is
     * appended; re-issuing the seek via a nudge can complete it. Off by default (only nudge over
     * genuinely buffered data). Default: false
     */
    readonly nudgeUnbuffered?: boolean
}

/**
 * Watches a media element after a seek/play and drives it back into a playing state. Some WebKit
 * versions stall: the play head freezes inside buffered data and playback never resumes (often with
 * a stale low readyState). This polls the play head and, while the element should be advancing:
 *
 * - if it's frozen inside buffered data, nudges currentTime forward to prod a resume;
 * - if there's no data at the playhead, waits (it's legitimately buffering, or between sources).
 *
 * When the play head progresses it calls {@link StallDetectorOptions.fabricatePlaying} if playback
 * resumed without a `playing` event (or after the detector revived it), then stops. It also stops
 * on pause/ended/emptied or after {@link StallDetectorOptions.maxAttempts}.
 *
 * Start it after a seek or play only when playback is intended — a paused element won't advance.
 */
export function createStallDetector(
    media: HTMLMediaElement,
    options: StallDetectorOptions
): () => void {
    const { fabricatePlaying } = options
    const pollInterval = options.pollInterval ?? 0.25
    const stallThreshold = options.stallThreshold ?? 0.75
    const bufferEndMargin = options.bufferEndMargin ?? 0.5
    const stallSkip = options.stallSkip ?? 0.1
    const maxAttempts = options.maxAttempts ?? 3
    const nudgeUnbuffered = options.nudgeUnbuffered ?? false

    let lastTime = media.currentTime
    let stalledFor = 0
    let attempts = 0
    let sawPlaying = false
    let recovered = false

    const onPlaying = () => {
        sawPlaying = true
    }
    // A cleared source (track unload) means there's nothing to recover.
    const onEmptied = () => stop()
    media.addEventListener('playing', onPlaying)
    media.addEventListener('emptied', onEmptied)

    const stop = () => {
        clearInterval(id)
        media.removeEventListener('playing', onPlaying)
        media.removeEventListener('emptied', onEmptied)
    }

    const id = setInterval(() => {
        // Only a playing element is expected to advance.
        if (media.paused || media.ended) return stop()

        if (media.currentTime !== lastTime) {
            lastTime = media.currentTime
            // Progressing. Announce playback if it resumed without a `playing`
            // event, or if the detector had to revive it (a prior `playing` was
            // cleared by the intervening stall).
            if (!sawPlaying || recovered) fabricatePlaying()
            return stop()
        }

        // Frozen. Recover only over buffered data; otherwise it's legitimately
        // waiting to buffer (or between sources) and nudging can disrupt
        // loading — except on platforms whose `buffered` is unreliable here
        // ({@link nudgeUnbuffered}), where re-issuing the seek is the recovery.
        if (!nudgeUnbuffered && !withinBufferedData(media, bufferEndMargin)) {
            stalledFor = 0
            return
        }

        stalledFor += pollInterval
        if (stalledFor < stallThreshold) return
        stalledFor = 0
        if (attempts++ >= maxAttempts) return stop()
        recovered = true
        // Data is buffered at the playhead — a small nudge prods a resume.
        // (iOS can sit here reporting a stale low readyState even though the
        // range around the playhead is buffered.)
        media.currentTime += stallSkip
        lastTime = media.currentTime
    }, pollInterval * 1000)

    return stop
}

/** True when the play head sits inside a buffered range, clear of its end by {@link endMargin}. */
function withinBufferedData(
    media: HTMLMediaElement,
    endMargin: number
): boolean {
    const t = media.currentTime
    const buffered = media.buffered
    for (let i = 0; i < buffered.length; i++) {
        if (t >= buffered.start(i) && t < buffered.end(i) - endMargin)
            return true
    }
    return false
}
