/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { supportsMse, type VinylTrackLoadOptions } from '@amazon/vinyl'
import { poll } from '@amazon/vinyl-util'
import {
    createVinylSuite,
    integAppendMode,
    vinylTestAssets,
} from '@amazon/vinyl/vinylTestUtil'

/**
 * Real start times of the asset's video segments: 8 × 4.5 s, 16 × 3 s, 8 × 4.5 s.
 * The MPD's SegmentList@duration says 3.75 s for each.
 */
const VIDEO_SEGMENT_STARTS = (() => {
    const durations = [
        ...Array<number>(8).fill(4.5),
        ...Array<number>(16).fill(3),
        ...Array<number>(8).fill(4.5),
    ]
    const starts = [0]
    for (const d of durations) starts.push(starts[starts.length - 1] + d)
    return starts
})()

/** Half a frame at 30 fps. */
const FRAME_TOLERANCE = 1 / 60

declare global {
    var ManagedMediaSource: typeof MediaSource | undefined
}

describe('dash approximate SegmentList integ', () => {
    const suite = createVinylSuite({}, { timeout: 90 })
    let sourceBuffers: Map<string, SourceBuffer>

    beforeEach(() => {
        if (!supportsMse()) pending('MSE not supported')
        sourceBuffers = new Map()
        // Records the source buffers the player creates, by content type.
        for (const type of [
            globalThis.ManagedMediaSource,
            globalThis.MediaSource,
        ]) {
            if (!type) continue
            const addSourceBuffer = type.prototype.addSourceBuffer
            spyOn(type.prototype, 'addSourceBuffer').and.callFake(function (
                this: MediaSource,
                mimeType: string
            ) {
                const sourceBuffer = addSourceBuffer.call(this, mimeType)
                sourceBuffers.set(mimeType.split('/')[0], sourceBuffer)
                return sourceBuffer
            })
        }
    })

    /** The source buffer's buffered range containing `time`. */
    function rangeAt(
        contentType: 'audio' | 'video',
        time: number
    ): [number, number] | null {
        const buffered = sourceBuffers.get(contentType)?.buffered
        if (!buffered) return null
        for (let i = 0; i < buffered.length; i++) {
            if (buffered.start(i) <= time && time < buffered.end(i))
                return [buffered.start(i), buffered.end(i)]
        }
        return null
    }

    function isVideoSegmentStart(time: number): boolean {
        return VIDEO_SEGMENT_STARTS.some(
            (start) => Math.abs(start - time) <= FRAME_TOLERANCE
        )
    }

    const tracks: readonly {
        readonly description: string
        readonly track: VinylTrackLoadOptions
        /** True if the MPD's segment times are approximate. */
        readonly approximate: boolean
    }[] = [
        {
            description: 'approximate SegmentList',
            track: {
                type: 'dash',
                uri: vinylTestAssets.dash.approx_segment_list,
            },
            approximate: true,
        },
        {
            description: 'exact SegmentBase',
            track: {
                type: 'dash',
                uri: vinylTestAssets.dash.approx_segment_list_sidx,
            },
            approximate: false,
        },
    ]

    for (const { description, track, approximate } of tracks) {
        describe(description, () => {
            beforeEach(() => {
                if (approximate && integAppendMode === 'sequence')
                    pending(
                        'sequence mode positions media at the approximate MPD times, putting audio and video out of sync'
                    )
            })

            // 33 s: the MPD's segment 8 starts at 30 s but its media at 36 s.
            // 80 s: the MPD's segment 21 starts at 78.75 s but its media at 75 s.
            for (const time of [33, 80]) {
                it(`places audio and video by their timestamps after seeking to ${time} s`, async () => {
                    const player = suite.player
                    player.load(track)
                    // Play before seeking: iOS stalls seeking a never-played element.
                    await player.play().catch(() => undefined)
                    await player.seekTo(time, 0.5).catch(() => undefined)
                    expect(
                        await poll(() => player.currentTime >= time + 1, {
                            timeout: 30,
                        })
                    )
                        .withContext(
                            `plays after the seek (at ${player.currentTime})`
                        )
                        .toBeTrue()

                    const now = player.currentTime
                    const video = rangeAt('video', now)
                    const audio = rangeAt('audio', now)
                    expect(video).withContext('video buffered').not.toBeNull()
                    expect(audio).withContext('audio buffered').not.toBeNull()
                    // The video buffer starts at a real segment boundary (not an
                    // MPD time), at or before the seek target.
                    expect(isVideoSegmentStart(video![0]))
                        .withContext(`video buffered from ${video![0]}`)
                        .toBeTrue()
                    expect(video![0]).toBeLessThanOrEqual(
                        time + FRAME_TOLERANCE
                    )
                    expect(audio![0]).toBeLessThanOrEqual(
                        time + FRAME_TOLERANCE
                    )
                })
            }
        })
    }
})
