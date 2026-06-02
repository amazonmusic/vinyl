/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type ChangeEvent,
    createEmptyMediaQualityMetadata,
    defaultSegmentControllerBaseOptions,
    type MediaTimeline,
    PREFETCH_POLL_THROTTLE,
    type PrefetchOptions,
    prefetchPriorityQueuesRef,
    type QualitySelector,
    SegmentControllerImpl,
    type SegmentControllerImplDeps,
    type SegmentDataProvider,
    type SegmentReference,
} from '@amazon/vinyl'
import type { Mutable, MutableDeep } from '@amazon/vinyl-util'
import {
    Abort,
    AbortError,
    Deferred,
    floorToNearest,
    mergeDeep,
    networkState,
    noop,
    sleep,
} from '@amazon/vinyl-util'
import { MockPlaybackController } from '@amazon/vinyl/vinylTestUtil'
import { data } from '@amazon/vinyl-observable'
import {
    createEventSpy,
    MockNetworkState,
    overrideGlobalInit,
    useMockLogger,
} from '@amazon/vinyl-util/testUtil'
import {
    flushPromises,
    mockEvent,
    useMockTime,
} from '@amazon/vinyl-util/browserTestUtil'
import any = jasmine.any
import Spy = jasmine.Spy
import createSpy = jasmine.createSpy
import objectContaining = jasmine.objectContaining

const timeUpdateEvent: ChangeEvent<number> = {
    previous: null,
    current: 0,
}

const defaultConfigOptions: PrefetchOptions = {
    trackPrefetchPriority: 0,
    startTime: 0,
}

describe('SegmentControllerImpl', () => {
    const loggerRef = useMockLogger()
    const clock = useMockTime()
    const mockNetworkStateRef = overrideGlobalInit(
        networkState,
        () => new MockNetworkState()
    )

    let segmentController: SegmentControllerImpl
    let playbackController: MockPlaybackController
    let mockDeps: SegmentControllerImplDeps
    let timelineData: ReturnType<typeof data<Promise<MediaTimeline>>>

    // Stub for tests that previously referenced the old SegmentProvider.
    // These tests need rework to use the new MediaTimeline-based API.
    let segmentProvider: {
        getSegment: Spy
        getDuration: Spy
        getMinBufferTime: Spy
        dispatch: Spy
    }

    let mockSegmentDataProvider: Spy<SegmentDataProvider>

    function createMockMediaSegment(
        time: number
    ): MutableDeep<SegmentReference<SegmentDataProvider>> {
        const startTime = floorToNearest(time, 10)
        return {
            initData: mockSegmentDataProvider,
            data: mockSegmentDataProvider,
            timestampOffset: startTime,
            startTime,
            endTime: startTime + 10,
            quality: {
                ...createEmptyMediaQualityMetadata(),
                decoderId: '1', // decoderId is used for init segment caching
            },
        }
    }

    beforeEach(() => {
        mockSegmentDataProvider = createSpy('SegmentDataProvider').and.callFake(
            () => Promise.resolve(new ArrayBuffer(0))
        )
        playbackController = new MockPlaybackController()

        segmentProvider = {
            getSegment: createSpy('getSegment').and.callFake((time: number) => {
                if (time >= 100) return Promise.resolve(null)
                return Promise.resolve(createMockMediaSegment(time))
            }),
            getDuration: createSpy('getDuration'),
            getMinBufferTime: createSpy('getMinBufferTime'),
            dispatch: createSpy('dispatch'),
        }

        const mockTimeline: MediaTimeline = {
            periods: [
                {
                    startTime: 0,
                    endTime: 100,
                    qualities: [
                        {
                            metadata: {
                                ...createEmptyMediaQualityMetadata(),
                                contentType: 'audio',
                                decoderId: '1',
                            },
                            getSegment: (time: number) =>
                                segmentProvider.getSegment(time),
                        },
                    ],
                },
            ],
            minBufferTime: 10,
            getDuration: () => Promise.resolve(100),
        }

        const mockQualitySelector: QualitySelector = {
            selectQuality: () => 0,
        }

        mockDeps = {
            playbackController: playbackController,
            mediaTimelineTransformed: (timelineData = data(
                Promise.resolve(mockTimeline)
            )),
            qualitySelector: mockQualitySelector,
        }

        segmentController = new SegmentControllerImpl(mockDeps, 'audio', {
            prefetchActive: 40,
            prefetchInactive: 20,
            retainTail: 30,
        })
    })

    async function fillPrefetch() {
        await clock.tick(...new Array<number>(10).fill(PREFETCH_POLL_THROTTLE))
    }

    afterEach(() => {
        if (!segmentController.disposed) segmentController.dispose()
        Object.values(prefetchPriorityQueuesRef.value).forEach((queue) =>
            queue.abort()
        )
    })

    it('initializes with default options if no options provided', () => {
        const segmentProvider = new SegmentControllerImpl(mockDeps, 'audio')
        expect(segmentProvider.options).toEqual(
            defaultSegmentControllerBaseOptions
        )
        segmentProvider.dispose()
    })

    it('merges custom options with default options', () => {
        const customOptions = { prefetchActive: 300 }
        const expectedOptions = {
            ...defaultSegmentControllerBaseOptions,
            ...customOptions,
        }
        const segmentProvider = new SegmentControllerImpl(
            mockDeps,
            'audio',
            customOptions
        )
        expect(segmentProvider.options).toEqual(expectedOptions)
        segmentProvider.dispose()
    })

    describe('activate and deactivate', () => {
        it('changes active state', () => {
            segmentController.activate()
            expect(segmentController.active).toBeTrue()
            segmentController.activate() // does nothing, already active
            expect(segmentController.active).toBeTrue()
            segmentController.deactivate()
            expect(segmentController.active).toBeFalse()
            segmentController.deactivate() // does nothing, already inactive
            expect(segmentController.active).toBeFalse()
        })
    })

    describe('when active', () => {
        it('prefetches from current time', async () => {
            expect(playbackController.hasListeners('timeUpdate')).toBeFalse()
            playbackController.currentTime = 50
            segmentController.configure({ startTime: 50 })
            segmentController.activate()
            expect(playbackController.hasListeners('timeUpdate')).toBeTrue()

            await fillPrefetch()

            // prefetch active is 40s from currentTime=50
            expect(segmentController.fetchedRanges.getRangeAt(50)).toEqual([
                50, 90,
            ])

            segmentController.deactivate()
            expect(playbackController.hasListeners('timeUpdate')).toBeFalse()
        })

        it(
            'clears cached segments not in the inactive prefetch range or active prefetch range including a' +
                ' retain tail',
            async () => {
                segmentController.configure(defaultConfigOptions)
                await fillPrefetch()
                expect(segmentController.fetchedRanges.ranges).toEqual([
                    [0, 20], // inactive prefetch range
                ])
                segmentController.activate()
                await fillPrefetch()
                expect(segmentController.fetchedRanges.ranges).toEqual([
                    [0, 40], // 40s = active prefetch
                ])
                playbackController.currentTime = 30
                playbackController.dispatch('timeUpdate', timeUpdateEvent)
                await fillPrefetch()
                expect(segmentController.fetchedRanges.ranges).toEqual([
                    [0, 70], // do not drop inactive range or retain tail
                ])

                playbackController.currentTime = 70
                playbackController.dispatch('timeUpdate', timeUpdateEvent)
                await fillPrefetch()
                expect(segmentController.fetchedRanges.ranges).toEqual([
                    [0, 20], // 0-20 inactive range
                    [40, 100], // 40-70 = 30s retain tail, 70-duration
                ])

                // When deactivated drop prefetched ranges not within inactive range.
                segmentController.deactivate()
                await clock.tick()
                expect(segmentController.fetchedRanges.ranges).toEqual([
                    [0, 20], // 0-20 inactive range
                ])
            }
        )

        describe('after a seeking event', () => {
            it('should prefetch from new position', async () => {
                segmentController.configure(defaultConfigOptions) // Begin prefetching
                await flushPromises()
                segmentController.activate()
                playbackController.currentTime = 30
                playbackController.dispatch('seeking', {})
                await clock.tick(PREFETCH_POLL_THROTTLE)
                expect(segmentController.fetchedRanges.ranges).toEqual([
                    [0, 10],
                    [30, 40],
                ])
            })

            it('should reset ended state', async () => {
                // A backwards seek would indicate polling should no longer no-op
                segmentController.configure(defaultConfigOptions) // Begin prefetching
                playbackController.currentTime = 95
                segmentController.activate()
                await clock.tick(PREFETCH_POLL_THROTTLE)
                playbackController.currentTime = 30
                playbackController.dispatch('seeking', {})
                await clock.tick(PREFETCH_POLL_THROTTLE)
                expect(segmentController.fetchedRanges.ranges).toEqual([
                    [0, 10],
                    [30, 40],
                ])
            })
        })

        describe('when mediaTimelineTransformed changes', () => {
            it('should reset bufferingEnded state', async () => {
                playbackController.currentTime = 95
                segmentController.activate()
                segmentController.configure(defaultConfigOptions) // Begin prefetching
                await fillPrefetch()

                // Update the timeline to extend to 110
                const extendedTimeline: MediaTimeline = {
                    periods: [
                        {
                            startTime: 0,
                            endTime: 110,
                            qualities: [
                                {
                                    metadata: {
                                        ...createEmptyMediaQualityMetadata(),
                                        contentType: 'audio',
                                        decoderId: '1',
                                    },
                                    getSegment: (time: number) => {
                                        if (time >= 110)
                                            return Promise.resolve(null)
                                        return Promise.resolve(
                                            createMockMediaSegment(time)
                                        )
                                    },
                                },
                            ],
                        },
                    ],
                    minBufferTime: 10,
                    getDuration: () => Promise.resolve(110),
                }
                timelineData.value = Promise.resolve(extendedTimeline)

                await fillPrefetch()
                // Active prefetch range from currentTime=95, plus inactive range from startTime=0
                expect(segmentController.fetchedRanges.getRangeAt(90)).toEqual([
                    90, 110,
                ])
            })
        })
    })

    describe('when inactive', () => {
        it('prefetches from startTime', async () => {
            segmentController.configure({
                startTime: 20,
                trackPrefetchPriority: 0,
            })
            await fillPrefetch()
            expect(segmentController.fetchedRanges.ranges).toEqual([[20, 40]]) // inactive prefetch time 20
        })
    })

    describe('when a segment prefetch fails', () => {
        describe('and the error is not silent', () => {
            const error = new Error('failed segment')
            beforeEach(() => {
                segmentProvider.getSegment.and.callFake((time) => {
                    return Promise.resolve({
                        ...createMockMediaSegment(time),
                        data: () => Promise.reject(error),
                    })
                })
            })

            it('logs the error', async () => {
                segmentController.configure(defaultConfigOptions)
                await flushPromises()
                expect(loggerRef.value.error).toHaveBeenCalledOnceWith(
                    any(Object),
                    'Error prefetching segment',
                    error
                )
            })

            it('stops prefetching', async () => {
                segmentController.configure(defaultConfigOptions)
                await flushPromises()
                expect(segmentController.error).not.toBeNull()
                segmentProvider.getSegment.calls.reset()
                playbackController.dispatch('timeUpdate', timeUpdateEvent)
                await clock.tick(PREFETCH_POLL_THROTTLE)
                expect(segmentProvider.getSegment).not.toHaveBeenCalled()
            })
        })

        describe('and the error is silent', () => {
            let mockSegmentReference: Mutable<
                SegmentReference<Spy<SegmentDataProvider>>
            >

            beforeEach(() => {
                mockSegmentReference = {
                    ...createMockMediaSegment(0),
                    initData: createSpy('initData').and.resolveTo(
                        new ArrayBuffer(0)
                    ),
                    data: createSpy('data').and.rejectWith(new AbortError()), // AbortError is silent.
                }

                segmentProvider.getSegment.and.callFake(() => {
                    return Promise.resolve(mockSegmentReference)
                })
            })

            it('does not log the error', async () => {
                segmentController.configure(defaultConfigOptions)
                await flushPromises()
                expect(loggerRef.value.error).not.toHaveBeenCalled()
            })

            it('allows the segment to be requested again', async () => {
                segmentController.configure(defaultConfigOptions)
                await expectAsync(
                    segmentController.getSegment(0)
                ).toBeRejectedWith(new AbortError())
                mockSegmentReference.data.and.resolveTo(new ArrayBuffer(0))
                await expectAsync(
                    segmentController.getSegment(0)
                ).toBeResolvedTo(
                    objectContaining({
                        data: any(ArrayBuffer),
                    })
                )
            })
        })
    })

    describe('getSegment', () => {
        it('immediately requests and returns a segment at a specified time', async () => {
            const segment90 = await segmentController.getSegment(95)
            expect(segment90?.startTime).toBe(90)

            expect(segment90?.initData).toEqual(any(ArrayBuffer))
            expect(segment90?.data).toEqual(any(ArrayBuffer))

            // The mock impl sets duration to 100 and returns null:
            expect(await segmentController.getSegment(100)).toBeNull()
        })

        it('returns null when no qualities match the content type', async () => {
            timelineData.value = Promise.resolve({
                periods: [
                    {
                        startTime: 0,
                        endTime: 100,
                        qualities: [
                            {
                                metadata: {
                                    ...createEmptyMediaQualityMetadata(),
                                    contentType: 'video',
                                },
                                getSegment: () => Promise.resolve(null),
                            },
                        ],
                    },
                ],
                minBufferTime: 10,
                getDuration: () => Promise.resolve(100),
            })
            // segmentController is for 'audio', but only 'video' qualities exist
            expect(await segmentController.getSegment(5)).toBeNull()
        })

        it('returns null when quality getSegment returns null within period', async () => {
            await fillPrefetch()
            segmentController.clear()
            await flushPromises()
            segmentProvider.getSegment.and.returnValue(Promise.resolve(null))
            // Request a time not in the cache (50 is outside inactive prefetch range)
            expect(await segmentController.getSegment(50)).toBeNull()
        })

        it('caches segment data', async () => {
            const segment90 = await segmentController.getSegment(95) // gets 90-100
            expect(segment90?.startTime).toBe(90)

            // Expect the segment data to be cached.
            expect((await segmentController.getSegment(90))?.data).toBe(
                segment90?.data
            )

            // Expect 80-90 range segment not to equal 90-100
            expect((await segmentController.getSegment(80))?.data).not.toBe(
                segment90?.data
            )
        })

        it('returns cached result when multiple segment slots are requested without waiting', async () => {
            // Creating segment slots is asynchronous, test that requesting the same slot at the same time
            // still provides cached data.
            await fillPrefetch()
            segmentController.clear()
            const CREATE_SEGMENT_DELAY = 1
            segmentProvider.getSegment.and.callFake(async (time: number) => {
                await sleep(CREATE_SEGMENT_DELAY)
                return createMockMediaSegment(time)
            })
            const promise1 = segmentController.getSegment(10)
            const promise2 = segmentController.getSegment(10)
            await flushPromises() // resolve timeline promise
            await clock.tick(CREATE_SEGMENT_DELAY)
            const segment1 = await promise1
            const segment2 = await promise2
            expect(segment1?.data).toBe(segment2?.data)
        })

        it('reuses init slots when decoderId is the same', async () => {
            await fillPrefetch()
            segmentController.clear()
            segmentProvider.getSegment.and.callFake((time: number) => {
                const use1 = time < 50
                return Promise.resolve(
                    mergeDeep([
                        createMockMediaSegment(time),
                        {
                            quality: {
                                ...createEmptyMediaQualityMetadata(),
                                decoderId: use1 ? '1' : '2',
                            },
                        } as const satisfies Partial<
                            SegmentReference<SegmentDataProvider>
                        >,
                    ])
                )
            })
            const s1 = await segmentController.getSegment(0)
            const s2 = await segmentController.getSegment(10)
            expect(s2!.initData).toBe(s1!.initData)
            const s5 = await segmentController.getSegment(50)
            expect(s5!.initData).not.toBe(s1!.initData)
            const s6 = await segmentController.getSegment(60)
            expect(s6!.initData).toBe(s5!.initData)
        })

        it('blocks new prefetches until active segments settle', async () => {
            await fillPrefetch()
            segmentController.clear()
            await flushPromises()
            mockSegmentDataProvider.and.callFake(() => new Deferred())
            mockSegmentDataProvider.calls.reset()
            async function resolvePendingDataRequests() {
                for (const call of mockSegmentDataProvider.calls.all()) {
                    const deferred = call.returnValue as Deferred<ArrayBuffer>
                    deferred.resolve(new ArrayBuffer(0))
                    await deferred
                }
            }
            playbackController.currentTime = 40

            const segmentPromise = segmentController.getSegment(45)
            await flushPromises()
            expect(mockSegmentDataProvider).toHaveBeenCalledTimes(2) // The active init and data segment
            segmentController.configure(defaultConfigOptions) // start polling
            playbackController.currentTime = 50 // Change time to avoid cached 40s segment
            expect(mockSegmentDataProvider).toHaveBeenCalledTimes(2) // Should not prefetch new segments

            // Expect when the active segments are resolved, prefetching can continue:
            await resolvePendingDataRequests()
            await segmentPromise
            await fillPrefetch()
            expect(mockSegmentDataProvider).toHaveBeenCalledTimes(3)
        })

        describe('when requested quality changes', () => {
            beforeEach(async () => {
                // Dispose and recreate to get a clean streamingQuality state
                segmentController.dispose()
                segmentProvider.getSegment.and.callFake((time: number) => {
                    if (time >= 100) return Promise.resolve(null)
                    const mockSegment = createMockMediaSegment(time)
                    mockSegment.quality.qualityId = time < 30 ? '1' : '2'
                    return Promise.resolve(mockSegment)
                })
                segmentController = new SegmentControllerImpl(
                    mockDeps,
                    'audio',
                    {
                        prefetchActive: 40,
                        prefetchInactive: 20,
                        retainTail: 30,
                    }
                )
                // Wait for initial onData to fire, then clear
                await fillPrefetch()
                segmentController.clear()
            })

            it('updates streamingQuality', async () => {
                const streamingQualityChangeSpy = createEventSpy(
                    segmentController,
                    'streamingQualityChange'
                )
                await segmentController.getSegment(1)
                expect(segmentController.streamingQuality?.qualityId).toEqual(
                    '1'
                )
                streamingQualityChangeSpy.calls.reset()

                await segmentController.getSegment(25)
                // streamingQuality reflects the most recently resolved quality,
                // which may include a min-buffer-time prefetch of the next segment.
                expect(segmentController.streamingQuality?.qualityId).toEqual(
                    '2'
                )
                streamingQualityChangeSpy.calls.reset()

                await segmentController.getSegment(30)
                expect(segmentController.streamingQuality?.qualityId).toEqual(
                    '2'
                )
                // Quality didn't change from '2' to '2'
                expect(streamingQualityChangeSpy).not.toHaveBeenCalled()
            })
        })

        describe('when aborted', () => {
            it('unblocks prefetch queue', async () => {
                await fillPrefetch()
                segmentController.clear()
                await flushPromises()
                mockSegmentDataProvider.and.callFake(() => new Deferred())
                mockSegmentDataProvider.calls.reset()
                playbackController.currentTime = 40

                const abort = new Abort()
                const segmentPromise = segmentController.getSegment(45, abort)
                await flushPromises()
                expect(mockSegmentDataProvider).toHaveBeenCalledTimes(2) // The active init and data segment
                playbackController.currentTime = 50 // Change time to avoid cached 40s segment
                segmentController.configure(defaultConfigOptions) // start polling
                expect(mockSegmentDataProvider).toHaveBeenCalledTimes(2) // Should not prefetch new segments

                // Expect when active segment is aborted, prefetching can continue.
                abort.abort()
                await segmentPromise.catch(noop)
                await fillPrefetch()
                expect(mockSegmentDataProvider).toHaveBeenCalledTimes(3)
            })
        })

        describe('when disposed', () => {
            it('rejects with AbortError', async () => {
                const segmentPromise = segmentController.getSegment(1)
                segmentController.dispose()
                await expectAsync(segmentPromise).toBeRejectedWithError(
                    AbortError
                )
            })
        })

        describe('error recovery', () => {
            const error = new Error('segment failed')

            beforeEach(() => {
                // fail first attempt, succeed second
                let failCount = 0
                mockSegmentDataProvider.and.callFake(() => {
                    return ++failCount <= 2
                        ? Promise.reject(error) // Fail for first initData and data prefetch
                        : Promise.resolve(new ArrayBuffer(0))
                })
            })

            it('retries failed prefetched segments and init segments', async () => {
                segmentController.configure(defaultConfigOptions)
                await flushPromises()
                expect(loggerRef.value.error).toHaveBeenCalledTimes(1)

                // Second request should succeed
                const segment = await segmentController.getSegment(0)
                expect(segment?.startTime).toBe(0)
                expect(segment?.data).toEqual(any(ArrayBuffer))
                expect(segment?.initData).toEqual(any(ArrayBuffer))
            })
        })
    })

    describe('minBufferTime', () => {
        describe('when the requested time is within minBufferTime of the segment end', () => {
            describe('and there is a next segment', () => {
                it('awaits fetching the next segment before resolving', async () => {
                    // minBufferTime is 10 from the mock timeline
                    await segmentController.getSegment(1) // within 10s of segment end (10)
                    expect(segmentController.fetchedRanges.ranges).toEqual([
                        [0, 20],
                    ])
                })
            })

            describe('and there is not a next segment', () => {
                it('resolves normally', async () => {
                    await segmentController.getSegment(91) // within 10s of segment end, but near end of timeline
                    expect(
                        segmentController.fetchedRanges.getRangeAt(90)
                    ).toEqual([90, 100])
                })
            })
        })
    })

    describe('clear', () => {
        it('clears all cached segments', async () => {
            // Cache some segments
            segmentController.configure(defaultConfigOptions)
            await clock.tick(PREFETCH_POLL_THROTTLE, PREFETCH_POLL_THROTTLE)
            expect(segmentController.fetchedRanges.ranges).toEqual([[0, 20]])

            segmentController.clear()
            expect(segmentController.fetchedRanges.ranges).toEqual([])

            segmentController.activate()
            playbackController.currentTime = 35
            playbackController.dispatch('timeUpdate', timeUpdateEvent)
            await clock.tick(PREFETCH_POLL_THROTTLE, PREFETCH_POLL_THROTTLE)
            expect(segmentController.fetchedRanges.ranges).toEqual([[30, 50]])
            segmentController.clear()
            expect(segmentController.fetchedRanges.ranges).toEqual([])
        })

        it('should reset the prefetching state', () => {
            segmentController.activate()
            segmentController.clear()
            expect(segmentController['ended']).toBeFalse()
        })
    })

    describe('configure', () => {
        describe('providing trackPrefetchPriority', () => {
            it('sets the track priority for prefetching', async () => {
                // Allow initial prefetch to complete before spying
                await fillPrefetch()
                const spy = spyOn(
                    prefetchPriorityQueuesRef.value.audio,
                    'enqueue'
                ).and.resolveTo()
                segmentController.clear()
                segmentController.configure({
                    trackPrefetchPriority: 3,
                    startTime: 0,
                })
                expect(segmentController.trackPrefetchPriority).toBe(3)
                await flushPromises()
                // Expects that the enqueue is made with the provided track priority.
                expect(spy.calls.mostRecent().args[1]!.trackPriority).toBe(3)
            })
        })

        it('allows for partial options', () => {
            segmentController.configure({
                trackPrefetchPriority: 1,
                startTime: 2,
            })
            expect(segmentController.trackPrefetchPriority).toBe(1)
            expect(segmentController.startTime).toBe(2)
            segmentController.configure({
                trackPrefetchPriority: 3,
            })
            expect(segmentController.trackPrefetchPriority).toBe(3)
            expect(segmentController.startTime).toBe(2)
            segmentController.configure({
                startTime: 4,
            })
            expect(segmentController.trackPrefetchPriority).toBe(3)
            expect(segmentController.startTime).toBe(4)
        })
    })

    describe('fetchedTime', () => {
        it('returns the number of seconds currently prefetched', async () => {
            segmentController.configure(defaultConfigOptions)
            await fillPrefetch()
            expect(segmentController.fetchedTime).toBe(20)
            playbackController.currentTime = 30
            segmentController.activate()
            expect(segmentController.fetchedTime).toBe(0)
            await fillPrefetch()
            expect(segmentController.fetchedTime).toBe(40)
            playbackController.currentTime = 65
            playbackController.dispatch('timeUpdate', timeUpdateEvent)
            expect(segmentController.fetchedTime).toBe(5)
            await fillPrefetch()
            expect(segmentController.fetchedTime).toBe(35) // 65-100 (duration)
        })
    })

    describe('dispose', () => {
        it('removes all playbackController listeners', () => {
            segmentController.dispose()
            expect(segmentController.disposed).toBeTrue()
            expect(playbackController.hasAnyListeners()).toBeFalse()
        })

        it('clears all cached segments', async () => {
            segmentController.configure(defaultConfigOptions)
            await clock.tick(PREFETCH_POLL_THROTTLE, PREFETCH_POLL_THROTTLE)
            segmentController.dispose()
            expect(segmentController.fetchedRanges.ranges).toEqual([])
            // dispose calls clear() which initiates another poll, ensure the poll is disposed.
            await clock.tick(PREFETCH_POLL_THROTTLE, PREFETCH_POLL_THROTTLE)
            expect(segmentController.fetchedRanges.ranges).toEqual([])
        })

        it('deactivates if active', () => {
            segmentController.activate()
            segmentController.dispose()
            expect(segmentController.active).toBeFalse()
        })

        it('aborts enqueued prefetch operations', async () => {
            mockSegmentDataProvider.and.callFake(() => new Deferred())
            segmentController.configure(defaultConfigOptions)
            const segmentPromise = segmentController.getSegment(0)
            segmentController.dispose()
            await expectAsync(segmentPromise).toBeRejectedWithError(AbortError)
            await flushPromises()
            expect(prefetchPriorityQueuesRef.value.audio.running).toBe(0)
        })

        describe('when an enqueued prefetch reaches its turn', () => {
            it('does not fetch a segment', async () => {
                await fillPrefetch()
                segmentProvider.getSegment.calls.reset()
                segmentController.dispose()
                await clock.tick(PREFETCH_POLL_THROTTLE)
                expect(segmentProvider.getSegment).not.toHaveBeenCalled()
            })
        })

        it('throws AbortError when disposed during quality getSegment', async () => {
            await fillPrefetch()
            segmentController.clear()
            await flushPromises()
            const deferred = new Deferred<null>()
            segmentProvider.getSegment.and.returnValue(deferred)
            const promise = segmentController.getSegment(50)
            await flushPromises() // let it reach the deferred
            segmentController.dispose()
            deferred.resolve(null)
            await flushPromises()
            await expectAsync(promise).toBeRejectedWithError(AbortError)
        })

        it('removes network state listener', () => {
            segmentController.dispose()
            expect(mockNetworkStateRef.value.hasAnyListeners()).toBeFalse()
        })
    })

    describe('reset', () => {
        const error = new Error('segment failed')

        beforeEach(() => {
            // fail first attempt, succeed second
            let failCount = 0
            mockSegmentDataProvider.and.callFake(() => {
                return ++failCount <= 2
                    ? Promise.reject(error) // Fail for first initData and data prefetch
                    : Promise.resolve(new ArrayBuffer(0))
            })
        })

        it('resets failed prefetched segments and init segments', async () => {
            segmentController.configure(defaultConfigOptions)
            // Do not flush promises, avoid prefetch

            // Init segment and data segment both expected to fail
            await expectAsync(segmentController.getSegment(0)).toBeRejectedWith(
                error
            )
            segmentController.reset()

            await expectAsync(segmentController.getSegment(0)).toBeResolved()
        })
    })

    describe('network state', () => {
        it('resets prefetch when network comes online', () => {
            const resetSpy = spyOn(segmentController, 'reset')
            mockNetworkStateRef.value.dispatch('online', mockEvent('online'))
            expect(resetSpy).toHaveBeenCalledOnceWith()
        })
    })
})
