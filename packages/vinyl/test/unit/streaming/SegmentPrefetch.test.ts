/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    enqueueSegmentPrefetch,
    prefetchPriorityQueuesRef,
    type SegmentPrefetchPriority,
} from '@amazon/vinyl'
import type { Mutable } from '@amazon/vinyl-util'
import { clone, Deferred, noop } from '@amazon/vinyl-util'
import { flushPromises, marbleTest } from '@amazon/vinyl-util/browserTestUtil'

describe('SegmentPrefetch', () => {
    describe('enqueueSegmentPrefetch', () => {
        it('appends a task to the prefetch task queue for the specified content type', async () => {
            const deferred = new Deferred<void>()
            const task = () => deferred
            const promise = enqueueSegmentPrefetch(task, 'audio', {
                trackPriority: 0,
                prefetchStartTime: 0,
                segmentStartTime: 0,
            })
            await expectAsync(promise).toBePending()
            expect(prefetchPriorityQueuesRef.value.audio.running).toBe(1)
            expect(prefetchPriorityQueuesRef.value.video.running).toBe(0)
            deferred.resolve()
            await promise
        })

        it('uses separate queues for different content types', async () => {
            const audioDeferred = new Deferred<void>()
            const videoDeferred = new Deferred<void>()
            const audioTask = () => audioDeferred
            const videoTask = () => videoDeferred

            const audioPromise = enqueueSegmentPrefetch(audioTask, 'audio', {
                trackPriority: 0,
                prefetchStartTime: 0,
                segmentStartTime: 0,
            })
            const videoPromise = enqueueSegmentPrefetch(videoTask, 'video', {
                trackPriority: 0,
                prefetchStartTime: 0,
                segmentStartTime: 0,
            })

            await expectAsync(audioPromise).toBePending()
            await expectAsync(videoPromise).toBePending()
            expect(prefetchPriorityQueuesRef.value.audio.running).toBe(1)
            expect(prefetchPriorityQueuesRef.value.video.running).toBe(1)

            audioDeferred.resolve()
            videoDeferred.resolve()
            await Promise.all([audioPromise, videoPromise])
        })

        /**
         * Provides a way to visualize segment prefetch priorities.
         */
        function createPriorityMarbleTest() {
            return marbleTest(
                () => {
                    const promise = new Deferred<void>()
                    const priority: Mutable<SegmentPrefetchPriority> = {
                        trackPriority: 0,
                        prefetchStartTime: -1,
                        segmentStartTime: 0,
                    }
                    // First requested segment will always be first regardless of priority, ignore from tests:
                    enqueueSegmentPrefetch(
                        () => promise,
                        'audio',
                        priority
                    ).catch(noop)
                    return {
                        priority,

                        currentIndex: 0,
                        promise,
                        actualOrder: [[]] as string[][], // [trackPriority][startTime]
                    }
                },
                {
                    '-': (state) => {
                        // dash represents no segment request at current time
                        state.actualOrder[state.priority.trackPriority][
                            state.priority.segmentStartTime
                        ] = '-'
                        state.priority.segmentStartTime++
                    },
                    '\n': (state) => {
                        // newline represents a new track
                        state.priority.trackPriority++
                        state.priority.prefetchStartTime = -1
                        state.priority.segmentStartTime = 0
                        state.actualOrder.push([])
                    },
                    x: (state) => {
                        // x represents a segment request for this time slot
                        // First x is considered the first needed segment for playback
                        if (state.priority.prefetchStartTime === -1) {
                            state.priority.prefetchStartTime =
                                state.priority.segmentStartTime
                        }

                        const priority = clone(state.priority)
                        enqueueSegmentPrefetch(
                            () => {
                                state.actualOrder[priority.trackPriority][
                                    priority.segmentStartTime
                                ] = (state.currentIndex++).toString(36)
                                return state.promise
                            },
                            'audio',
                            priority
                        ).catch(noop)

                        state.priority.segmentStartTime++
                    },
                },
                async (o) => {
                    o.promise.resolve()
                    await o.promise
                    await flushPromises()
                    return o.actualOrder.map((t) => t.join('')).join('\n')
                }
            )
        }

        async function testPriorityOrder(
            input: string,
            expected: string
        ): Promise<void> {
            expect(
                await createPriorityMarbleTest()(
                    input.trim().replace(/[\t ]+/g, '')
                )
            ).toEqual(expected.trim().replace(/[\t ]+/g, ''))
        }

        it('prioritizes by whether it is first segment, then by track priority', async () => {
            // Tracks enqueue one segment at a time, and not out of order; segment start time does not need to
            // affect sorting.
            // Last row represents highest track priority, first row is lowest.

            // Simulate each track enqueuing two segments, with start time of 0:
            await testPriorityOrder(
                `
                xx
                xx
                xx
                xx
                `,
                `
                37
                26
                15
                04
                `
            )

            // Simulate each track enqueuing three segments, with varying start times:
            await testPriorityOrder(
                `
                xxx
                --xxx
                ---xxx
                -xxx
                `,
                `
                3ab
                --289
                ---167
                -045
                `
            )

            // Chaotic input, first segments should be higher priority than later segments, then by track priority
            await testPriorityOrder(
                `
                ----x
                -x--x
                x--xx
                -----x
                `,
                `
                ----3
                -2--6
                1--45
                -----0
                `
            )
        })
    })
})
