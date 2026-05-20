/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMockTime } from '@amazon/vinyl-util/browserTestUtil'
import {
    AbortError,
    compare,
    compareBy,
    createTaskQueue,
    never,
    noop,
    sleep,
    type TaskQueue,
    withAbort,
} from '@amazon/vinyl-util'
import createSpy = jasmine.createSpy

describe('TaskQueue', () => {
    let taskQueue: TaskQueue
    const clock = useMockTime()

    beforeEach(() => {
        taskQueue = createTaskQueue()
    })

    describe('enqueue', () => {
        it('adds a task to the queue', async () => {
            const task1 = taskQueue.enqueue(async () => {
                await sleep(1)
                return 3
            })

            const task2 = taskQueue.enqueue(async () => {
                await sleep(1)
                return 4
            })

            await expectAsync(task2).toBePending()
            await clock.tick(1)
            await expectAsync(task1).toBeResolvedTo(3)
            await expectAsync(task2).toBePending()
            await clock.tick(1)
            await expectAsync(task2).toBeResolvedTo(4)
        })

        describe('when the provided task rejects', () => {
            it('rejects the promise returned by enqueue', async () => {
                await expectAsync(
                    taskQueue.enqueue(() => Promise.reject(new Error('reason')))
                ).toBeRejectedWithError('reason')

                const sleepPromise = taskQueue.enqueue(async () => {
                    await sleep(1)
                })

                const rejectPromise2 = taskQueue.enqueue(() =>
                    Promise.reject(new Error('reason2'))
                )

                await clock.tick(0.9)
                await expectAsync(rejectPromise2).toBePending()
                await clock.tick(0.1)
                await sleepPromise
                await expectAsync(rejectPromise2).toBeRejectedWithError(
                    'reason2'
                )
                expect(taskQueue.running).toBe(0)
            })
        })

        describe('when the provided task throws', () => {
            it('rejects the promise returned by enqueue', async () => {
                await expectAsync(
                    taskQueue.enqueue(() => {
                        throw new Error('reason')
                    })
                ).toBeRejectedWithError('reason')
                expect(taskQueue.running).toBe(0)
            })
        })
    })

    describe('simultaneous', () => {
        describe('when increased', () => {
            it('executes pending tasks until new value is reached', () => {
                taskQueue.enqueue(() => never).catch(noop)
                taskQueue.enqueue(() => never).catch(noop)
                taskQueue.enqueue(() => never).catch(noop)
                taskQueue.enqueue(() => never).catch(noop)
                taskQueue.enqueue(() => never).catch(noop)
                expect(taskQueue.running).toBe(1)
                taskQueue.simultaneous = 5
                expect(taskQueue.running).toBe(5)
                // Should not abort tasks when reducing
                taskQueue.simultaneous = 1
                expect(taskQueue.running).toBe(5)
            })
        })
    })

    describe('running', () => {
        it('returns the number of tasks currently running', async () => {
            const task = () => sleep(1)
            expect(taskQueue.running).toBe(0)
            taskQueue.enqueue(task).catch(noop)

            expect(taskQueue.running).toBe(1)
            taskQueue.enqueue(task).catch(noop)

            expect(taskQueue.running).toBe(1)
            await clock.tick(1)
            expect(taskQueue.running).toBe(1)
            await clock.tick(1)
            expect(taskQueue.running).toBe(0)

            taskQueue.simultaneous = 3
            taskQueue.enqueue(task).catch(noop)
            taskQueue.enqueue(task).catch(noop)
            expect(taskQueue.running).toBe(2)
            taskQueue.enqueue(task).catch(noop)
            expect(taskQueue.running).toBe(3)
            await clock.tick(1)
            expect(taskQueue.running).toBe(0)
        })
    })

    describe('abort', () => {
        it('aborts the current abort controller', async () => {
            taskQueue.abort() // Does nothing when not running
            taskQueue.simultaneous = 3

            const task1 = taskQueue.enqueue((abort) =>
                withAbort(sleep(1), abort)
            )
            const task2 = taskQueue.enqueue((abort) =>
                withAbort(sleep(1), abort)
            )
            const task3 = taskQueue.enqueue((abort) =>
                withAbort(sleep(1), abort)
            )

            const reason = new Error('expected')
            taskQueue.abort(reason)

            await expectAsync(task1).toBeRejectedWith(reason)
            await expectAsync(task2).toBeRejectedWith(reason)
            await expectAsync(task3).toBeRejectedWith(reason)

            const task4 = taskQueue.enqueue((abort) =>
                withAbort(sleep(1), abort)
            )
            const task5 = taskQueue.enqueue((abort) =>
                withAbort(sleep(1), abort)
            )
            await expectAsync(task4).toBePending()
            await expectAsync(task5).toBePending()
            const reason2 = new Error('expected 2')
            taskQueue.abort(reason2)
            await expectAsync(task4).toBeRejectedWith(reason2)
            await expectAsync(task5).toBeRejectedWith(reason2)
        })

        it('rejects pending tasks and clears queue', async () => {
            const spy = createSpy('task spy').and.callFake(() => sleep(1))
            const task1 = taskQueue.enqueue(spy)
            const task2 = taskQueue.enqueue(spy)
            const task3 = taskQueue.enqueue(spy)
            expect(spy).toHaveBeenCalledTimes(1) // First task should be in active
            spy.calls.reset()
            taskQueue.abort()
            await expectAsync(task1).toBeRejectedWith(new AbortError())
            await expectAsync(task2).toBeRejectedWith(new AbortError())
            await expectAsync(task3).toBeRejectedWith(new AbortError())
            expect(spy).not.toHaveBeenCalled()
        })
    })

    describe('when a comparator is provided', () => {
        it('prioritizes tasks', () => {
            const taskQueue = createTaskQueue(compare, 0)
            taskQueue.simultaneous = 0
            const spy0 = createSpy('spy0')
            const spy1 = createSpy('spy1')
            const spy2 = createSpy('spy2')
            const spy3 = createSpy('spy3')
            const spy4 = createSpy('spy4')
            const spy5 = createSpy('spy5')
            taskQueue.enqueue(spy5, 5).catch(noop)
            taskQueue.enqueue(spy2, 2).catch(noop)
            taskQueue.enqueue(spy0).catch(noop)
            taskQueue.enqueue(spy4, 4).catch(noop)
            taskQueue.enqueue(spy1, 1).catch(noop)
            taskQueue.enqueue(spy3, 3).catch(noop)

            taskQueue.simultaneous = 6

            expect(spy0).toHaveBeenCalledBefore(spy1)
            expect(spy1).toHaveBeenCalledBefore(spy2)
            expect(spy2).toHaveBeenCalledBefore(spy3)
            expect(spy3).toHaveBeenCalledBefore(spy4)
            expect(spy4).toHaveBeenCalledBefore(spy5)
        })

        it('uses the comparator for the provided priority values', async () => {
            interface Priority {
                readonly first: number
                readonly second: string
            }

            const taskQueue = createTaskQueue(
                compareBy<Priority>(
                    (e) => e.first,
                    (e) => e.second
                ),
                { first: 1, second: 'c' }
            )
            const spy0a = createSpy('spy0a')
            const spy0b = createSpy('spy0b')
            const spy1a = createSpy('spy1a')
            const spy1b = createSpy('spy1b')
            const spy1c = createSpy('spy1c')
            const spy2a = createSpy('spy2a')
            const spy2b = createSpy('spy2b')

            taskQueue
                .enqueue(spy0a, {
                    first: 0,
                    second: 'a',
                })
                .catch(noop)
            taskQueue
                .enqueue(spy0b, {
                    first: 0,
                    second: 'b',
                })
                .catch(noop)
            taskQueue
                .enqueue(spy1a, {
                    first: 1,
                    second: 'a',
                })
                .catch(noop)
            taskQueue
                .enqueue(spy1b, {
                    first: 1,
                    second: 'b',
                })
                .catch(noop)
            taskQueue
                .enqueue(spy2a, {
                    first: 2,
                    second: 'a',
                })
                .catch(noop)
            taskQueue.enqueue(spy1c).catch(noop)
            taskQueue
                .enqueue(spy2b, {
                    first: 2,
                    second: 'b',
                })
                .catch(noop)

            taskQueue.simultaneous = 2
            await clock.tick()

            expect(spy0a).toHaveBeenCalledBefore(spy0b)
            expect(spy0b).toHaveBeenCalledBefore(spy1a)
            expect(spy1a).toHaveBeenCalledBefore(spy1b)
            expect(spy1b).toHaveBeenCalledBefore(spy1c)
            expect(spy1c).toHaveBeenCalledBefore(spy2a)
            expect(spy2a).toHaveBeenCalledBefore(spy2b)
        })
    })
})
