/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { flushPromises, useMockTime } from '@amazon/vinyl-util/browserTestUtil'
import {
    MockMediaSourceController,
    MockPlaybackController,
    MockSegmentController,
    MockSourceBufferController,
} from '@amazon/vinyl/vinylTestUtil'
import {
    type BufferingControllerEventMap,
    BufferingControllerImpl,
    type BufferingControllerImplOptions,
    type ChangeEvent,
    clearSourceBufferQuota,
    type ContentType,
    createEmptyMediaQualityMetadata,
    DEFAULT_MAX_APPEND_SIZE,
    DURATION_PADDING,
    getSourceBufferQuota,
    LIVE_DURATION,
    type MediaQualityMetadata,
    MIN_APPEND_SIZE,
    POLL_BUFFER_THROTTLE,
    QUOTA_REACHED_SCALE,
    SEGMENT_START_AFFORDANCE,
    type SegmentReference,
} from '@amazon/vinyl'
import type { MutableDeep, Task } from '@amazon/vinyl-util'
import {
    Abort,
    AbortError,
    Deferred,
    floorToNearest,
    LogLevel,
} from '@amazon/vinyl-util'
import type { EventSpy } from '@amazon/vinyl-util/testUtil'
import { createEventSpy, useMockLogger } from '@amazon/vinyl-util/testUtil'
import any = jasmine.any
import objectContaining = jasmine.objectContaining

const INIT_DATA_SIZE = 1
const SEGMENT_DURATION = 10
const DURATION = 100
const MIN_BUFFER_TIME = 2

class MockQuotaExceededError extends Error {
    constructor() {
        super()
        this.name = 'QuotaExceededError'
    }
}

const timeUpdateEvent: ChangeEvent<number> = {
    previous: null,
    current: 0,
}

type MockSegmentReference = MutableDeep<SegmentReference<ArrayBuffer>>

function createMockSegment(time: number, size = 1): MockSegmentReference {
    // Mirror SegmentControllerImpl.getSegment, which clamps negative request times to 0
    // and forward-snaps by SEGMENT_START_AFFORDANCE before resolving the underlying segment.
    const snapped = Math.max(0, time) + SEGMENT_START_AFFORDANCE
    const startTime = floorToNearest(snapped, 10)
    const endTime = Math.min(DURATION, startTime + SEGMENT_DURATION)
    return {
        initData: new ArrayBuffer(INIT_DATA_SIZE),
        data: new ArrayBuffer(size),
        timestampOffset: startTime,
        startTime,
        endTime,
        quality: {
            ...createEmptyMediaQualityMetadata(),
            bandwidth: size / SEGMENT_DURATION,
            contentType: 'audio',
        },
    }
}

describe('BufferingControllerImpl', () => {
    let mediaSourceController: MockMediaSourceController
    let playbackController: MockPlaybackController
    let segmentController: MockSegmentController
    let sourceBufferController: MockSourceBufferController
    let bufferingController: BufferingControllerImpl

    const clock = useMockTime()
    const loggerRef = useMockLogger()
    // When pollBufferImmediate is called, a poll will execute on the next frame
    // Returns a promise to await the next frame and the throttled execute
    function nextPollImmediate(): Promise<void> {
        return clock.tick(0, 0)
    }

    /**
     * Configures the segment controller to provide segments with the given sizes and content type.
     *
     * @param sizes A list of sizes for the segments.
     * @param timeOffset The segments will each be 10s, starting from timeOffset.
     * @param contentType The content type to apply to all segments.
     */
    function setSegmentList(
        sizes: readonly number[],
        timeOffset: number = 0,
        contentType: ContentType = 'audio'
    ) {
        const segments = new Array<Promise<MockSegmentReference>>(sizes.length)
        for (let i = 0; i < sizes.length; i++) {
            const segment = createMockSegment(i * 10 + timeOffset, sizes[i])
            segment.quality.contentType = contentType
            segments[i] = Promise.resolve(segment)
        }
        segmentController.getSegment.and.returnValues(
            ...segments,
            Promise.resolve(null)
        )
        segmentController.dispatch('change', {})
    }

    /**
     * Sets the current time, emits a timeUpdate event, and awaits the next poll.
     * @param value
     */
    async function setTime(value: number): Promise<void> {
        playbackController.currentTime = value
        playbackController.dispatch('timeUpdate', timeUpdateEvent)
        await clock.tick(POLL_BUFFER_THROTTLE)
    }

    function getMostRecentAppendData(): ArrayBuffer {
        return sourceBufferController.append.calls.mostRecent().args[0]
    }

    beforeEach(() => {
        mediaSourceController = new MockMediaSourceController()
        mediaSourceController.duration = Number.NaN
        playbackController = new MockPlaybackController()
        segmentController = new MockSegmentController()
        segmentController.getSegment.and.callFake((time) => {
            if (time >= DURATION) return Promise.resolve(null)
            return Promise.resolve(createMockSegment(time))
        })
    })

    /**
     * Creates a source buffer controller that simulates buffering.
     */
    function createSourceBufferController(): MockSourceBufferController {
        const sourceBufferController = new MockSourceBufferController()
        sourceBufferController.enqueue.and.callFake(<T>(task: Task<T>) => {
            return Promise.resolve(task(new Abort()))
        })

        // Simulate buffering time ranges
        let appendWindowStart = 0
        let appendWindowEnd = Number.POSITIVE_INFINITY
        let offset = 0

        sourceBufferController.clear.and.callFake(() => {
            sourceBufferController.buffered.clear()
            return Promise.resolve()
        })

        sourceBufferController.setTimestampOffset.and.callFake((value) => {
            offset = value
            return Promise.resolve()
        })

        sourceBufferController.setAppendWindow.and.callFake(
            (start = 0, end = Number.POSITIVE_INFINITY) => {
                appendWindowStart = start
                appendWindowEnd = end
                return Promise.resolve()
            }
        )

        sourceBufferController.append.and.callFake((buffer: ArrayBuffer) => {
            expect(bufferingController.bufferingQuality).toBeDefined()
            const segmentBandwidth =
                bufferingController.bufferingQuality?.bandwidth
            if (segmentBandwidth) {
                const secondsBuffered = buffer.byteLength / segmentBandwidth
                const appendingTo = offset
                offset = Math.min(offset + secondsBuffered, appendWindowEnd)
                sourceBufferController.buffered.add(
                    Math.max(appendWindowStart, appendingTo),
                    offset
                )
            }
            return Promise.resolve()
        })

        sourceBufferController.remove.and.callFake((start, end) => {
            sourceBufferController.buffered.remove(start, end)
            return Promise.resolve()
        })
        return sourceBufferController
    }

    afterEach(() => {
        if (!bufferingController.disposed) bufferingController.dispose()
    })

    function createBufferingController(
        options?: Partial<BufferingControllerImplOptions>
    ) {
        return new BufferingControllerImpl(
            {
                mediaSourceController: mediaSourceController,
                playbackController,
                segmentController,
                sourceBufferControllerFactory: () => {
                    sourceBufferController = createSourceBufferController()
                    return sourceBufferController
                },
            },
            'video',
            {
                minBuffer: MIN_BUFFER_TIME,
                ...options,
            }
        )
    }

    async function open(): Promise<void> {
        mediaSourceController.readyState = 'open'
        mediaSourceController.dispatch('sourceOpen', {})
        await clock.tick(0)
    }

    describe('getBufferedTime', () => {
        beforeEach(() => {
            bufferingController = createBufferingController()
        })

        it('returns the amount of time buffered from the current position', async () => {
            expect(bufferingController.getBufferedTime()).toBe(0)
            bufferingController.activate()
            await open()
            expect(bufferingController.getBufferedTime()).toBe(10)

            playbackController.currentTime = 50
            expect(bufferingController.getBufferedTime()).toBe(0)
            playbackController.dispatch('seeking', {})
            await nextPollImmediate()
            expect(bufferingController.getBufferedTime()).toBe(10)

            playbackController.currentTime = 55
            expect(bufferingController.getBufferedTime()).toBe(5)
        })
    })

    describe('when appending errs', () => {
        beforeEach(() => {
            bufferingController = createBufferingController()
            bufferingController.activate()
        })

        describe('when the error is fatal', () => {
            beforeEach(() => {
                segmentController.getSegment.and.callFake((_) => {
                    return Promise.reject(new Error('fatal error'))
                })
            })

            it('buffering stops', async () => {
                await open()
                expect(bufferingController.error).toBeInstanceOf(Error)
                segmentController.getSegment.calls.reset()
                await setTime(0)
                expect(segmentController.getSegment).not.toHaveBeenCalled()
            })
        })

        describe('when the error is not fatal', () => {
            beforeEach(() => {
                segmentController.getSegment.and.returnValues(
                    Promise.reject(new AbortError()),
                    Promise.resolve(createMockSegment(0))
                )
            })

            it('buffering is not stopped', async () => {
                // The media source opening will initiate the first pollBuffer, that will reject with the silent
                // error, which resets the throttle and tries again on the next frame.
                await open()
                expect(bufferingController.error).toBeNull()
                expect(segmentController.getSegment).toHaveBeenCalledTimes(1)
                await nextPollImmediate()
                expect(segmentController.getSegment).toHaveBeenCalledTimes(2)
            })
        })
    })

    describe('when buffer is low', () => {
        beforeEach(() => {
            bufferingController = createBufferingController()
            bufferingController.activate()
        })

        // And not in an erred state, and media source is open
        it('appends next segment', async () => {
            playbackController.currentTime = 40
            await open()
            expect(bufferingController.getBufferedTime()).toBe(10)
            expect(sourceBufferController.buffered.ranges).toEqual([[40, 50]])

            await setTime(50 - MIN_BUFFER_TIME + 0.1)
            expect(sourceBufferController.buffered.ranges).toEqual([[40, 60]])
        })
    })

    describe('when segments exceed max append size', () => {
        beforeEach(() => {
            bufferingController = createBufferingController({
                maxAppendSize: {
                    audio: 100,
                    video: 300,
                },
                minBuffer: 2.0,
            })
            bufferingController.activate()
        })

        it('fills buffer to max append size', async () => {
            setSegmentList([400])
            await open()
            expect(sourceBufferController.append).toHaveBeenCalledTimes(1)
            expect(getMostRecentAppendData().byteLength).toEqual(100)
            expect(bufferingController.getBufferedTime()).toBeCloseToWithin(2.5)
            sourceBufferController.append.calls.reset()
            await setTime(0.49)
            expect(sourceBufferController.append).not.toHaveBeenCalled()
            await setTime(0.5) // Within the 2s min buffer
            expect(sourceBufferController.append).toHaveBeenCalledTimes(1)
            expect(getMostRecentAppendData().byteLength).toEqual(
                // max append size is 100, subtract the current buffered 2s
                100 - (2 * 400) / 10
            )

            sourceBufferController.append.calls.reset()
            await setTime(0.99)
            expect(sourceBufferController.append).not.toHaveBeenCalled()
            await setTime(1)
            expect(sourceBufferController.append).toHaveBeenCalledTimes(1)
            sourceBufferController.append.calls.reset()
        })

        describe('when min buffer exceeds max append size', () => {
            it('does not append', async () => {
                setSegmentList([1000])
                await open()
                sourceBufferController.append.calls.reset()
                await setTime(0)
                expect(sourceBufferController.append).not.toHaveBeenCalled()
                await setTime(1)
                expect(sourceBufferController.append).toHaveBeenCalled()
            })
        })

        describe('when contentType is video', () => {
            it('uses video settings', async () => {
                setSegmentList(
                    [
                        1200 /* 2.5s slices */, 1860 /* 1.61s slices */,
                        1380 /* 2.17s slices */,
                    ],
                    0,
                    'video'
                )
                await open()
                expect(sourceBufferController.append).toHaveBeenCalledTimes(1)
                expect(getMostRecentAppendData().byteLength).toEqual(300)
                expect(bufferingController.getBufferedTime()).toBeCloseToWithin(
                    2.5
                )
                sourceBufferController.append.calls.reset()
                await setTime(0.49)
                expect(sourceBufferController.append).not.toHaveBeenCalled()
                await setTime(0.5) // Within the 2s min buffer
                expect(sourceBufferController.append).toHaveBeenCalledTimes(1)
            })
        })

        describe('when contentType is undefined', () => {
            it('uses DEFAULT_MAX_APPEND_SIZE for max byte length', async () => {
                setSegmentList(
                    [DEFAULT_MAX_APPEND_SIZE * 2],
                    0,
                    'unknown' as any
                )
                await open()
                expect(sourceBufferController.append).toHaveBeenCalledTimes(1)
                expect(getMostRecentAppendData().byteLength).toEqual(
                    DEFAULT_MAX_APPEND_SIZE
                )
            })
        })
    })

    describe('when buffer is filled', () => {
        beforeEach(() => {
            bufferingController = createBufferingController()
            bufferingController.activate()
        })

        it('does not append segments', async () => {
            await open()
            expect(bufferingController.getBufferedTime()).toBe(10)

            segmentController.getSegment.calls.reset()
            await setTime(1)
            expect(segmentController.getSegment).not.toHaveBeenCalled()
            expect(bufferingController.getBufferedTime()).toBe(9)
        })
    })

    describe('when seeking', () => {
        beforeEach(() => {
            bufferingController = createBufferingController()
            bufferingController.activate()
        })

        it('clears and sets a new offset', async () => {
            await open()
            expect(bufferingController.getBufferedTime()).toBe(10)

            playbackController.currentTime = 20
            playbackController.dispatch('seeking', {})
            // Seeking should clear the throttle timer, no need to wait for POLL_BUFFER_THROTTLE
            await nextPollImmediate()
            expect(sourceBufferController.buffered.ranges).toEqual([[20, 30]])
        })
    })

    describe('when log level is verbose', () => {
        beforeEach(() => {
            bufferingController = createBufferingController()
            bufferingController.activate()
            loggerRef.value.logLevel = LogLevel.VERBOSE
        })

        it('logs poll buffer messages', async () => {
            await open()
            expect(loggerRef.value.verbose).toHaveBeenCalledWith(
                bufferingController,
                `pollBuffer time: 0, bufferedTime: 0, busy: false, error: false, readyState: open`
            )
        })
    })

    describe('clear', () => {
        beforeEach(() => {
            bufferingController = createBufferingController({
                maxAppendSize: {
                    audio: 1000,
                    video: 3000,
                },
                minBuffer: 2.0,
            })
            bufferingController.activate()
        })

        it('clears the source buffer', async () => {
            await open()
            bufferingController.clear()
            await nextPollImmediate()
            expect(sourceBufferController.clear).toHaveBeenCalledOnceWith()

            // Do not make calls to the source buffer if deactivated
            sourceBufferController.clear.calls.reset()
            playbackController.currentTime = 9
            playbackController.dispatch('timeUpdate', timeUpdateEvent)
            bufferingController.clear()
            bufferingController.deactivate()
            await nextPollImmediate()
            expect(sourceBufferController.clear).not.toHaveBeenCalled()
        })

        it('aborts the current segment request', async () => {
            const deferred =
                new Deferred<SegmentReference<ArrayBuffer> | null>()
            segmentController.getSegment.and.returnValue(deferred)
            await open()
            const abort =
                segmentController.getSegment.calls.mostRecent().args[1]
            bufferingController.clear()
            expect(abort?.aborted()).toBeTrue()
        })

        it('emits a playbackQualityChange with null quality', async () => {
            await open()
            playbackController.dispatch('timeUpdate', timeUpdateEvent)
            await clock.tick(POLL_BUFFER_THROTTLE)
            const changeSpy = createEventSpy(
                bufferingController,
                'playbackQualityChange'
            )
            const previous = bufferingController.playbackQuality
            expect(previous).not.toBeNull()
            bufferingController.clear()
            await flushPromises()
            expect(changeSpy).toHaveBeenCalledOnceWith({
                previous,
                current: null,
            })
            expect(bufferingController.playbackQuality).toBeNull()
        })

        it('resets bufferingEnded to false when in buffering ended state', async () => {
            setSegmentList([])
            await open()
            await nextPollImmediate()
            expect(bufferingController.bufferingEnded).toBeTrue()

            bufferingController.clear()
            await flushPromises()
            expect(bufferingController.bufferingEnded).toBeFalse()
        })

        describe('when not active', () => {
            it('does nothing', async () => {
                await open()
                bufferingController.deactivate()
                bufferingController.clear()
                expect(sourceBufferController.clear).not.toHaveBeenCalled()
            })
        })
    })

    describe('when decoderId changes', () => {
        beforeEach(() => {
            bufferingController = createBufferingController()
            bufferingController.activate()
        })

        it('re-initializes the decoder', async () => {
            await open()
            expect(sourceBufferController.appendInit).toHaveBeenCalledTimes(1)
            sourceBufferController.appendInit.calls.reset()

            segmentController.getSegment.and.callFake((time) => {
                const mockSegment = createMockSegment(time)
                mockSegment.quality.decoderId = 'different'
                mockSegment.quality.mimeType = 'opus'
                return Promise.resolve(mockSegment)
            })
            playbackController.currentTime = 9
            playbackController.dispatch('seeking', {})
            await nextPollImmediate()
            expect(sourceBufferController.appendInit).toHaveBeenCalledOnceWith(
                any(ArrayBuffer),
                'opus'
            )
        })
    })

    describe('when segment controller returns null', () => {
        beforeEach(() => {
            bufferingController = createBufferingController()
            bufferingController.activate()
        })

        it('ends the stream', async () => {
            setSegmentList([])
            const endedSpy = createEventSpy(
                bufferingController,
                'bufferingEnded'
            )
            await open()
            await nextPollImmediate()
            expect(endedSpy).toHaveBeenCalledTimes(1)
            expect(bufferingController.bufferingQuality).toBeNull()
            expect(bufferingController.bufferingEnded).toBeTrue()
            expect(bufferingController.busy).toBeFalse()
        })

        describe('then segment controller emits a change event', () => {
            it('reopens the stream', async () => {
                setSegmentList([])
                await open()
                await flushPromises()
                mediaSourceController.dispatch('sourceEnded', {})
                await flushPromises()
                segmentController.getSegment.calls.reset()
                mediaSourceController.readyState = 'ended'
                setSegmentList([1, 1, 1]) // Emits a change event
                await nextPollImmediate()
                expect(segmentController.getSegment).toHaveBeenCalledTimes(1)
            })
        })
    })

    describe('when append throws a QuotaExceededError', () => {
        afterEach(() => {
            clearSourceBufferQuota()
        })

        it('does not set to an erred state', async () => {
            bufferingController = createBufferingController()
            bufferingController.activate()
            sourceBufferController.append.and.rejectWith(
                new MockQuotaExceededError()
            )
            await open()
            expect(bufferingController.error).toBeNull()
            expect(loggerRef.value.warn).toHaveBeenCalledTimes(1)
        })

        it('sets the sourceBufferQuota for the current content type', async () => {
            setSegmentList(Array<number>(20).fill(1), 0, 'video')
            bufferingController = createBufferingController({
                minBuffer: Number.MAX_VALUE, // Buffer all segments
                maxAppendSize: {
                    video: 10 * 1024 * 1024, // 10 MiB,
                },
            })
            bufferingController.activate()
            await open()
            await clock.tick()
            expect(bufferingController.getBufferedTime()).toBe(20)

            sourceBufferController.append.and.rejectWith(
                new MockQuotaExceededError()
            )

            // After each rejection, the quota should be reduced until MIN_APPEND_SIZE is reached.
            await clock.tick()
            expect(getSourceBufferQuota('video')).toEqual(
                10 * 1024 * 1024 * QUOTA_REACHED_SCALE
            )
            await clock.tick() // append rejects again
            expect(getSourceBufferQuota('video')).toEqual(
                10 * 1024 * 1024 * QUOTA_REACHED_SCALE * QUOTA_REACHED_SCALE
            )
            await clock.tick() // append rejects again
            expect(getSourceBufferQuota('video')).toEqual(
                10 * 1024 * 1024 * Math.pow(QUOTA_REACHED_SCALE, 3)
            )

            await clock.tick(...Array<number>(20).fill(0))
            expect(bufferingController.error?.name).toEqual(
                'QuotaExceededError'
            )
        })

        describe('and reduced size falls below MIN_APPEND_SIZE', () => {
            it('sets to an erred state', async () => {
                bufferingController = createBufferingController({
                    maxAppendSize: {
                        audio: MIN_APPEND_SIZE,
                    },
                })
                bufferingController.activate()
                sourceBufferController.append.and.rejectWith(
                    new MockQuotaExceededError()
                )
                await open()
                await setTime(0)
                expect(bufferingController.error?.name).toBe(
                    'QuotaExceededError'
                )
            })
        })
    })

    describe('when media source provided is already open', () => {
        it('polls on construction', async () => {
            await open()
            bufferingController = createBufferingController()
            bufferingController.activate()
            await nextPollImmediate()
            expect(bufferingController.getBufferedTime()).toBe(10)
        })
    })

    describe('duration', () => {
        beforeEach(() => {
            bufferingController = createBufferingController()
            bufferingController.activate()
        })

        describe('when the media source is open and the segment controller is not updating', () => {
            it('is set to the segment controller provided value', async () => {
                segmentController.getDuration.and.resolveTo(33)
                await open()
                expect(mediaSourceController.duration).toEqual(
                    33 + DURATION_PADDING
                )
            })

            describe('when segment controller duration resolves to null', () => {
                it('sets mediaSource duration to LIVE_DURATION', async () => {
                    segmentController.getDuration.and.resolveTo(null)
                    await open()
                    expect(mediaSourceController.duration).toEqual(
                        LIVE_DURATION
                    )
                })
            })
        })

        describe('when segment controller emits a change event', () => {
            it('refreshes duration', async () => {
                segmentController.getDuration.and.resolveTo(42)
                await open()
                expect(mediaSourceController.duration).toEqual(
                    42 + DURATION_PADDING
                )
                segmentController.getDuration.and.resolveTo(54)
                segmentController.dispatch('change', {})
                await nextPollImmediate()
                expect(mediaSourceController.duration).toEqual(
                    54 + DURATION_PADDING
                )
            })

            describe('and mediaSource is not open', () => {
                it('does nothing', () => {
                    // Closed
                    segmentController.getDuration.and.resolveTo(52)
                    segmentController.dispatch('change', {})
                    expect(mediaSourceController.duration).toBeNaN()
                })
            })
        })
    })

    describe('playbackQuality', () => {
        // The time to simulate a quality change from q1 to q2:
        let changeTime: number
        let playbackQualityChange: EventSpy<
            BufferingControllerEventMap,
            'playbackQualityChange'
        >

        beforeEach(() => {
            changeTime = 20
            segmentController.getSegment.and.callFake((time) => {
                if (time >= DURATION) return Promise.resolve(null)
                const segment = createMockSegment(time)
                segment.quality.qualityId = time < changeTime ? 'q1' : 'q2'
                return Promise.resolve(segment)
            })
        })

        async function setTime(time: number): Promise<void> {
            playbackController.currentTime = time
            playbackController.dispatch('timeUpdate', timeUpdateEvent)
            await clock.tick(POLL_BUFFER_THROTTLE)
        }

        describe('when at most two segments are buffered', () => {
            beforeEach(() => {
                bufferingController = createBufferingController()
                bufferingController.activate()
                playbackQualityChange = createEventSpy(
                    bufferingController,
                    'playbackQualityChange'
                )
            })

            it('returns the encoding metadata of the currently playing segment', async () => {
                expect(bufferingController.playbackQuality).toBeNull()
                await open()
                await setTime(0)
                expect(bufferingController.playbackQuality?.qualityId).toBe(
                    'q1'
                )
                expect(playbackQualityChange).toHaveBeenCalledTimes(1)
                playbackQualityChange.calls.reset()

                // time < 20 will still be q1
                await setTime(12)
                expect(playbackQualityChange).not.toHaveBeenCalled()

                // 20-30s will now be buffered but q1 is still playing
                await setTime(19)
                expect(playbackQualityChange).not.toHaveBeenCalled()

                // now moving onto q2
                await setTime(20)
                expect(playbackQualityChange).toHaveBeenCalledOnceWith({
                    previous: objectContaining<MediaQualityMetadata>({
                        qualityId: 'q1',
                    }),
                    current: objectContaining<MediaQualityMetadata>({
                        qualityId: 'q2',
                    }),
                })
                expect(bufferingController.playbackQuality?.qualityId).toBe(
                    'q2'
                )
            })
        })

        describe('when multiple segments are buffered', () => {
            beforeEach(() => {
                changeTime = 30
                bufferingController = createBufferingController({
                    minBuffer: 50,
                })
                bufferingController.activate()
                playbackQualityChange = createEventSpy(
                    bufferingController,
                    'playbackQualityChange'
                )
            })

            it('returns the encoding metadata of the currently playing segment', async () => {
                await open()
                await setTime(0)
                expect(bufferingController.playbackQuality?.qualityId).toBe(
                    'q1'
                )
                expect(playbackQualityChange).toHaveBeenCalledTimes(1)
                playbackQualityChange.calls.reset()

                // time < 30 will still be q1
                for (let i = 5; i <= 25; i += 5) {
                    await setTime(i)
                }
                expect(playbackQualityChange).not.toHaveBeenCalled()
                expect(bufferingController.playbackQuality?.qualityId).toBe(
                    'q1'
                )

                // Once playback reaches the changeover, expect playbackQuality to change.
                await setTime(changeTime)
                expect(bufferingController.playbackQuality?.qualityId).toBe(
                    'q2'
                )
                expect(playbackQualityChange).toHaveBeenCalledOnceWith({
                    previous: objectContaining<MediaQualityMetadata>({
                        qualityId: 'q1',
                    }),
                    current: objectContaining<MediaQualityMetadata>({
                        qualityId: 'q2',
                    }),
                })

                playbackQualityChange.calls.reset()

                // Change back to the q1
                await setTime(changeTime - 1)
                // A backwards time update can only happen after a seek
                playbackController.dispatch('seeking', {})
                await nextPollImmediate()

                expect(bufferingController.playbackQuality?.qualityId).toBe(
                    'q1'
                )
            })
        })
    })

    describe('bufferingQuality', () => {
        // The time to simulate a quality change from q1 to q2:
        let changeTime: number
        let bufferingQualityChange: EventSpy<
            BufferingControllerEventMap,
            'bufferingQualityChange'
        >

        beforeEach(() => {
            changeTime = 20
            segmentController.getSegment.and.callFake((time) => {
                if (time >= DURATION) return Promise.resolve(null)
                const segment = createMockSegment(time)
                segment.quality.qualityId = time < changeTime ? 'q1' : 'q2'
                return Promise.resolve(segment)
            })
        })

        describe('when multiple segments are buffered', () => {
            beforeEach(() => {
                changeTime = 30
                bufferingController = createBufferingController({
                    minBuffer: 50,
                })
                bufferingController.activate()
                bufferingQualityChange = createEventSpy(
                    bufferingController,
                    'bufferingQualityChange'
                )
            })

            it('returns the encoding metadata of the currently buffering segment', async () => {
                await open()
                expect(bufferingController.bufferingQuality?.qualityId).toBe(
                    'q1'
                )
                expect(bufferingQualityChange).toHaveBeenCalledOnceWith({
                    previous: null,
                    current: objectContaining({
                        qualityId: 'q1',
                    }),
                })
                bufferingQualityChange.calls.reset()

                // each frame tick will append a new segment until the 50s min buffer is filled
                // after changeTime (30s) the buffered quality is expected to change to q2.
                await nextPollImmediate()
                expect(bufferingController.bufferingQuality?.qualityId).toBe(
                    'q1'
                )
                await clock.tick(0)
                expect(bufferingController.bufferingQuality?.qualityId).toBe(
                    'q2'
                )
                expect(bufferingQualityChange).toHaveBeenCalledOnceWith({
                    previous: objectContaining({
                        qualityId: 'q1',
                    }),
                    current: objectContaining({
                        qualityId: 'q2',
                    }),
                })
                bufferingQualityChange.calls.reset()

                // Go back to time 0, buffering first quality
                playbackController.currentTime = 0
                playbackController.dispatch('seeking', {})
                await flushPromises()
                expect(bufferingQualityChange).toHaveBeenCalledOnceWith({
                    previous: objectContaining({
                        qualityId: 'q2',
                    }),
                    current: null,
                })
                bufferingQualityChange.calls.reset()

                await nextPollImmediate()
                expect(bufferingQualityChange).toHaveBeenCalledOnceWith({
                    previous: null,
                    current: objectContaining({
                        qualityId: 'q1',
                    }),
                })
                expect(bufferingController.bufferingQuality?.qualityId).toBe(
                    'q1'
                )
            })
        })
    })

    describe('reset', () => {
        beforeEach(() => {
            bufferingController = createBufferingController()
        })

        it('does nothing when there is no error', () => {
            expect(bufferingController.error).toBeNull()
            bufferingController.reset()
            expect(bufferingController.error).toBeNull()
        })

        it('clears error and polls buffer when there is an error', async () => {
            // Trigger error by making segment controller fail
            segmentController.getSegment.and.rejectWith(new Error('test error'))
            bufferingController.activate()
            await open()

            expect(bufferingController.error).not.toBeNull()

            // Reset segment controller to succeed and reset call count
            segmentController.getSegment.and.resolveTo(createMockSegment(0))
            segmentController.getSegment.calls.reset()

            bufferingController.reset()
            await nextPollImmediate()

            expect(bufferingController.error).toBeNull()
            expect(segmentController.getSegment).toHaveBeenCalled()
        })
    })

    describe('dispose', () => {
        beforeEach(() => {
            bufferingController = createBufferingController()
            bufferingController.activate()
        })

        it('removes event handlers', () => {
            bufferingController.dispose()
            expect(bufferingController.disposed).toBeTrue()
            expect(bufferingController.active).toBeFalse()
            expect(playbackController.hasAnyListeners()).toBeFalse()
            expect(segmentController.hasAnyListeners()).toBeFalse()
        })
    })

    describe('activate', () => {
        describe('when active', () => {
            it('does nothing', () => {
                bufferingController = createBufferingController()
                bufferingController.activate()
                const firstSourceBufferController = sourceBufferController
                bufferingController.activate()
                expect(bufferingController.active).toBeTrue()
                expect(sourceBufferController).toBe(firstSourceBufferController)
            })
        })

        it('creates a new source buffer', () => {
            bufferingController = createBufferingController()
            bufferingController.activate()
            const firstSourceBufferController = sourceBufferController
            bufferingController.deactivate()
            bufferingController.activate()
            expect(bufferingController.active).toBeTrue()
            expect(sourceBufferController).not.toBe(firstSourceBufferController)
            expect(firstSourceBufferController.dispose).toHaveBeenCalledTimes(1)
            bufferingController.deactivate()
            expect(sourceBufferController.dispose).toHaveBeenCalledTimes(1)
        })
    })

    describe('getSourceBufferQuota', () => {
        beforeEach(() => {
            bufferingController = createBufferingController()
        })

        it('returns null when quota is not known', () => {
            expect(getSourceBufferQuota('text')).toBeNull()
        })
    })
})
