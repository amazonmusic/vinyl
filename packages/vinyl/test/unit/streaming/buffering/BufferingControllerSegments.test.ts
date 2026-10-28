/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMockTime } from '@amazon/vinyl-util/browserTestUtil'
import {
    MockMediaSourceController,
    MockPlaybackController,
    MockSegmentController,
    MockSourceBufferController,
} from '@amazon/vinyl/vinylTestUtil'
import {
    BufferingControllerImpl,
    type BufferingControllerImplOptions,
    type ChangeEvent,
    createEmptyMediaQualityMetadata,
    MAX_ALIGN_STEPS,
    type MediaQualityMetadata,
    POLL_BUFFER_THROTTLE,
    SEGMENT_START_AFFORDANCE,
    type SegmentReference,
} from '@amazon/vinyl'
import {
    getFragmentTimeRange,
    getMp4InitTiming,
    type Mp4InitTiming,
    type Task,
} from '@amazon/vinyl-util'
import { Abort } from '@amazon/vinyl-util'
import { useMockLogger } from '@amazon/vinyl-util/testUtil'

const TIMESCALE = 1000
const MIN_BUFFER_TIME = 2

const timeUpdateEvent: ChangeEvent<number> = { previous: null, current: 0 }

function concat(...parts: readonly Uint8Array[]): Uint8Array {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
    let offset = 0
    for (const part of parts) {
        out.set(part, offset)
        offset += part.length
    }
    return out
}

function uint32(...values: readonly number[]): Uint8Array {
    const out = new Uint8Array(values.length * 4)
    const view = new DataView(out.buffer)
    values.forEach((v, i) => view.setUint32(i * 4, v))
    return out
}

function box(type: string, ...payload: readonly Uint8Array[]): Uint8Array {
    const body = concat(...payload)
    const typeBytes = new Uint8Array(
        [0, 1, 2, 3].map((i) => type.charCodeAt(i))
    )
    return concat(uint32(8 + body.length), typeBytes, body)
}

function fullBox(
    type: string,
    flags: number,
    ...payload: readonly Uint8Array[]
): Uint8Array {
    return box(type, uint32(flags), ...payload)
}

/** An init segment whose track has the test timescale. */
function createInit(): ArrayBuffer {
    const mdhd = fullBox('mdhd', 0, uint32(0, 0, TIMESCALE, 0, 0))
    return box('moov', box('trak', box('mdia', mdhd))).buffer as ArrayBuffer
}

/**
 * A media segment with one fragment covering `[start, end)` seconds of media
 * time, padded to `size` bytes.
 */
function createFragment(start: number, end: number, size = 0): ArrayBuffer {
    const tfdt = fullBox('tfdt', 0, uint32(Math.round(start * TIMESCALE)))
    // One sample, with its duration present (flag 0x100).
    const trun = fullBox(
        'trun',
        0x100,
        uint32(1, Math.round((end - start) * TIMESCALE))
    )
    const moof = box(
        'moof',
        box('traf', fullBox('tfhd', 0, uint32(1)), tfdt, trun)
    )
    const padding = Math.max(0, size - moof.length - 8)
    return concat(moof, box('mdat', new Uint8Array(padding)))
        .buffer as ArrayBuffer
}

interface SegmentSpec {
    /** Manifest start and end times. */
    readonly start: number
    readonly end: number
    /** Media timestamps of the segment's samples; null for non-mp4 data. */
    readonly media: readonly [number, number] | null
    readonly mediaTimeOffset?: number
    readonly decoderId?: string
    readonly size?: number
}

type MockSegment = SegmentReference<ArrayBuffer>

describe('BufferingControllerImpl in segments mode', () => {
    let mediaSourceController: MockMediaSourceController
    let playbackController: MockPlaybackController
    let segmentController: MockSegmentController
    let sourceBufferController: MockSourceBufferController
    let bufferingController: BufferingControllerImpl
    let segments: MockSegment[]
    const inits = new Map<string, ArrayBuffer>()

    const clock = useMockTime()
    useMockLogger()

    function quality(decoderId: string): MediaQualityMetadata {
        return {
            ...createEmptyMediaQualityMetadata(),
            qualityId: decoderId,
            decoderId,
            bandwidth: 1,
            contentType: 'video',
            mimeType: 'video/mp4',
        }
    }

    function setSegments(specs: readonly SegmentSpec[]) {
        segments = specs.map((spec) => {
            const decoderId = spec.decoderId ?? 'a'
            let initData = inits.get(decoderId)
            if (!initData) {
                initData = createInit()
                inits.set(decoderId, initData)
            }
            const segment: MockSegment = {
                initData,
                data: spec.media
                    ? createFragment(spec.media[0], spec.media[1], spec.size)
                    : new ArrayBuffer(spec.size ?? 1),
                timestampOffset: spec.start,
                ...(spec.mediaTimeOffset != null
                    ? { mediaTimeOffset: spec.mediaTimeOffset }
                    : {}),
                startTime: spec.start,
                endTime: spec.end,
                quality: quality(decoderId),
            }
            return segment
        })
    }

    /** Segments every `manifest` seconds whose media is `media` seconds long. */
    function setApproximateSegments(
        count: number,
        manifest: number,
        media: number,
        mediaTimeOffset: number | undefined = 0
    ) {
        setSegments(
            Array.from({ length: count }, (_, i) => ({
                start: i * manifest,
                end: (i + 1) * manifest,
                media: [i * media, (i + 1) * media],
                mediaTimeOffset,
            }))
        )
    }

    /**
     * Simulates a segments-mode source buffer: each append is buffered at the
     * timestamp offset plus its media timestamps.
     */
    function createSourceBufferController(): MockSourceBufferController {
        const controller = new MockSourceBufferController()
        let offset = 0
        let timing: Mp4InitTiming | null = null
        controller.enqueue.and.callFake(<T>(task: Task<T>) =>
            Promise.resolve(task(new Abort()))
        )
        controller.clear.and.callFake(() => {
            controller.buffered.clear()
            return Promise.resolve()
        })
        controller.appendInit.and.callFake((initData: ArrayBuffer) => {
            timing = getMp4InitTiming(initData)
            return Promise.resolve()
        })
        controller.setTimestampOffset.and.callFake((value: number) => {
            offset = value
            return Promise.resolve()
        })
        controller.append.and.callFake((data: ArrayBuffer) => {
            const range = timing && getFragmentTimeRange(data, timing)
            if (range)
                controller.buffered.add(
                    offset + range.start,
                    offset + range.end
                )
            return Promise.resolve()
        })
        return controller
    }

    function createBufferingController(
        options?: Partial<BufferingControllerImplOptions>
    ) {
        return new BufferingControllerImpl(
            {
                mediaSourceController,
                playbackController,
                segmentController,
                sourceBufferControllerFactory: () => {
                    sourceBufferController = createSourceBufferController()
                    return sourceBufferController
                },
            },
            'video',
            { minBuffer: MIN_BUFFER_TIME, ...options }
        )
    }

    beforeEach(() => {
        inits.clear()
        mediaSourceController = new MockMediaSourceController()
        playbackController = new MockPlaybackController()
        segmentController = new MockSegmentController()
        // Mirrors SegmentControllerImpl: the segment whose manifest start is at or
        // before the time plus the affordance.
        segmentController.getSegment.and.callFake((time: number) => {
            const t = Math.max(0, time) + SEGMENT_START_AFFORDANCE
            const segment = [...segments]
                .reverse()
                .find((s) => s.startTime <= t)
            return Promise.resolve(
                segment && time < segment.endTime ? { ...segment } : null
            )
        })
        bufferingController = createBufferingController()
        bufferingController.activate()
    })

    afterEach(() => {
        if (!bufferingController.disposed) bufferingController.dispose()
    })

    async function open(): Promise<void> {
        mediaSourceController.readyState = 'open'
        mediaSourceController.dispatch('sourceOpen', {})
        await clock.tick(0)
    }

    async function setTime(value: number): Promise<void> {
        playbackController.currentTime = value
        playbackController.dispatch('timeUpdate', timeUpdateEvent)
        await clock.tick(POLL_BUFFER_THROTTLE)
    }

    it('is the default append mode', () => {
        expect(bufferingController.options.appendMode).toBe('segments')
    })

    describe('with a manifest media time offset (DASH)', () => {
        it('places media by its timestamps and sets the offset once', async () => {
            // Manifest segments are 10 s; the media's are 10 s too, starting at 0.
            setApproximateSegments(6, 10, 10)
            await open()
            expect(sourceBufferController.buffered.ranges).toEqual([[0, 10]])
            await setTime(9)
            expect(sourceBufferController.buffered.ranges).toEqual([[0, 20]])
            expect(
                sourceBufferController.setTimestampOffset
            ).toHaveBeenCalledOnceWith(0)
        })

        it('steps forward when the manifest segment ends before the playhead', async () => {
            // Manifest says 10 s per segment; the media is 8 s per segment.
            setApproximateSegments(6, 10, 8)
            playbackController.currentTime = 25
            await open()
            // Manifest segment 2 (20–30) is media 16–24; segment 3 is 24–32.
            expect(sourceBufferController.buffered.ranges).toEqual([[24, 32]])
            expect(bufferingController.getBufferedTime()).toBe(7)
        })

        it('steps back when the manifest segment starts after the playhead', async () => {
            // Manifest says 10 s per segment; the media is 12 s per segment.
            setApproximateSegments(6, 10, 12)
            playbackController.currentTime = 21
            await open()
            // Manifest segment 2 (20–30) is media 24–36; segment 1 is 12–24.
            expect(sourceBufferController.buffered.ranges).toEqual([[12, 24]])
            expect(bufferingController.getBufferedTime()).toBe(3)
        })

        it('steps over several segments', async () => {
            setApproximateSegments(10, 10, 6)
            playbackController.currentTime = 50
            await open()
            // Media segment 8 is 48–54.
            expect(sourceBufferController.buffered.ranges).toEqual([[48, 54]])
        })

        it('continues contiguously after aligning', async () => {
            setApproximateSegments(6, 10, 8)
            playbackController.currentTime = 25
            await open()
            await setTime(31)
            expect(sourceBufferController.buffered.ranges).toEqual([[24, 40]])
            expect(
                sourceBufferController.setTimestampOffset
            ).toHaveBeenCalledOnceWith(0)
        })

        it('keeps the offset across a decoder change', async () => {
            setSegments([
                { start: 0, end: 10, media: [0, 8], mediaTimeOffset: 0 },
                {
                    start: 10,
                    end: 20,
                    media: [8, 16],
                    mediaTimeOffset: 0,
                    decoderId: 'b',
                },
            ])
            await open()
            await setTime(7)
            expect(sourceBufferController.appendInit).toHaveBeenCalledTimes(2)
            expect(
                sourceBufferController.setTimestampOffset
            ).toHaveBeenCalledOnceWith(0)
            expect(sourceBufferController.buffered.ranges).toEqual([[0, 16]])
        })

        it('changes the offset with the media time offset (e.g. a new Period)', async () => {
            setSegments([
                { start: 0, end: 10, media: [0, 10], mediaTimeOffset: 0 },
                // A Period at 10 s whose media starts at 60 s.
                { start: 10, end: 20, media: [60, 70], mediaTimeOffset: -50 },
            ])
            await open()
            await setTime(9)
            expect(
                sourceBufferController.setTimestampOffset.calls.allArgs()
            ).toEqual([[0], [-50]])
            expect(sourceBufferController.buffered.ranges).toEqual([[0, 20]])
        })

        it('reports the playback quality at the media boundary', async () => {
            setSegments([
                { start: 0, end: 10, media: [0, 6], mediaTimeOffset: 0 },
                {
                    start: 10,
                    end: 20,
                    media: [6, 16],
                    mediaTimeOffset: 0,
                    decoderId: 'b',
                },
            ])
            await open()
            await setTime(5)
            expect(bufferingController.playbackQuality?.decoderId).toBe('a')
            await setTime(6.5)
            expect(bufferingController.playbackQuality?.decoderId).toBe('b')
        })
    })

    describe('without a manifest media time offset (HLS)', () => {
        it('anchors the media timestamps at the manifest time', async () => {
            // Media timestamps start at 100 s (e.g. MPEG-TS PTS).
            setSegments([
                { start: 0, end: 10, media: [100, 110] },
                { start: 10, end: 20, media: [110, 120] },
            ])
            await open()
            await setTime(9)
            expect(
                sourceBufferController.setTimestampOffset
            ).toHaveBeenCalledOnceWith(-100)
            expect(sourceBufferController.buffered.ranges).toEqual([[0, 20]])
        })

        it('keeps the anchor within the tolerance', async () => {
            setSegments([
                { start: 0, end: 10, media: [100, 110] },
                // Manifest time drifts; media continues.
                { start: 10.5, end: 20, media: [110, 120] },
            ])
            await open()
            await setTime(9)
            expect(
                sourceBufferController.setTimestampOffset
            ).toHaveBeenCalledOnceWith(-100)
        })

        it('re-anchors after a discontinuity in the media timestamps', async () => {
            setSegments([
                { start: 0, end: 10, media: [100, 110] },
                { start: 10, end: 20, media: [500, 510] },
            ])
            await open()
            await setTime(9)
            expect(
                sourceBufferController.setTimestampOffset.calls.allArgs()
            ).toEqual([[-100], [-490]])
            expect(sourceBufferController.buffered.ranges).toEqual([[0, 20]])
        })

        it('re-anchors after clearing', async () => {
            setSegments([
                { start: 0, end: 10, media: [100, 110] },
                { start: 10, end: 20, media: [110, 120] },
            ])
            await open()
            bufferingController.clear()
            await clock.tick(0)
            await clock.tick(0)
            // Offset is set again even though the value is unchanged.
            expect(
                sourceBufferController.setTimestampOffset.calls.allArgs()
            ).toEqual([[-100], [-100]])
        })

        it('does not align by media time', async () => {
            setSegments([
                { start: 0, end: 10, media: [0, 8] },
                { start: 10, end: 20, media: [8, 16] },
            ])
            playbackController.currentTime = 9
            await open()
            // The playlist time is the reference: segment 0 is placed at 0–8.
            expect(segmentController.getSegment).toHaveBeenCalledTimes(1)
        })
    })

    describe('without media timestamps', () => {
        it('places segments at their manifest timestamp offset', async () => {
            setSegments([
                { start: 0, end: 10, media: null },
                { start: 10, end: 20, media: null },
            ])
            await open()
            await setTime(9)
            expect(
                sourceBufferController.setTimestampOffset.calls.allArgs()
            ).toEqual([[0], [10]])
        })
    })

    describe('alignment edge cases', () => {
        it('keeps the later segment when the media has a gap at the playhead', async () => {
            setSegments([
                { start: 0, end: 10, media: [0, 9], mediaTimeOffset: 0 },
                { start: 10, end: 20, media: [11, 20], mediaTimeOffset: 0 },
            ])
            playbackController.currentTime = 10
            await open()
            expect(sourceBufferController.buffered.ranges).toEqual([[11, 20]])
        })

        it('keeps the later segment when a forward step overshoots a gap', async () => {
            setSegments([
                { start: 0, end: 10, media: [0, 4], mediaTimeOffset: 0 },
                { start: 10, end: 20, media: [6, 20], mediaTimeOffset: 0 },
            ])
            playbackController.currentTime = 5
            await open()
            expect(sourceBufferController.buffered.ranges).toEqual([[6, 20]])
        })

        it('starts at the first segment even if its media starts later', async () => {
            setSegments([
                { start: 0, end: 10, media: [0.05, 10], mediaTimeOffset: 0 },
            ])
            await open()
            expect(segmentController.getSegment).toHaveBeenCalledTimes(1)
            expect(sourceBufferController.buffered.ranges).toEqual([[0.05, 10]])
        })

        it('accepts a segment starting at the playhead', async () => {
            setApproximateSegments(3, 10, 10)
            playbackController.currentTime = 10
            await open()
            expect(segmentController.getSegment).toHaveBeenCalledTimes(1)
            expect(sourceBufferController.buffered.ranges).toEqual([[10, 20]])
        })

        it('stops when there is no next segment', async () => {
            setSegments([
                { start: 0, end: 10, media: [0, 5], mediaTimeOffset: 0 },
            ])
            playbackController.currentTime = 7
            await open()
            expect(sourceBufferController.buffered.ranges).toEqual([[0, 5]])
        })

        it('stops when the previous segment does not precede it', async () => {
            setSegments([
                { start: 0, end: 10, media: [0, 10], mediaTimeOffset: 0 },
                { start: 10, end: 20, media: [15, 25], mediaTimeOffset: 0 },
            ])
            playbackController.currentTime = 12
            // The lookup for the previous segment returns the same segment.
            segmentController.getSegment.and.callFake((time: number) =>
                Promise.resolve(time >= 20 ? null : { ...segments[1] })
            )
            await open()
            expect(segmentController.getSegment).toHaveBeenCalledTimes(2)
            expect(sourceBufferController.buffered.ranges).toEqual([[15, 25]])
        })

        it('stops when the next segment does not follow it', async () => {
            setSegments([
                { start: 0, end: 10, media: [0, 5], mediaTimeOffset: 0 },
            ])
            playbackController.currentTime = 7
            segmentController.getSegment.and.callFake(() =>
                Promise.resolve({ ...segments[0] })
            )
            await open()
            expect(segmentController.getSegment).toHaveBeenCalledTimes(2)
        })

        it(`steps at most ${MAX_ALIGN_STEPS} segments`, async () => {
            setApproximateSegments(30, 10, 1)
            playbackController.currentTime = 25
            await open()
            expect(segmentController.getSegment).toHaveBeenCalledTimes(
                MAX_ALIGN_STEPS + 1
            )
        })
    })

    describe('partial appends', () => {
        beforeEach(() => {
            bufferingController.dispose()
            bufferingController = createBufferingController({
                maxAppendSize: { video: 600 },
            })
            bufferingController.activate()
        })

        it('sets the offset on the first chunk only', async () => {
            setSegments([
                {
                    start: 0,
                    end: 10,
                    media: [0, 10],
                    mediaTimeOffset: 0,
                    size: 1000,
                },
            ])
            await open()
            expect(sourceBufferController.append).toHaveBeenCalledTimes(1)
            // The rest is appended once the buffer drops below the minimum.
            await setTime(8.5)
            expect(sourceBufferController.append).toHaveBeenCalledTimes(2)
            expect(
                sourceBufferController.setTimestampOffset
            ).toHaveBeenCalledOnceWith(0)
            expect(sourceBufferController.buffered.ranges).toEqual([[0, 10]])
        })
    })
})
