/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Abort, EventHostImpl, nextEventAsPromise } from '@amazon/vinyl-util'
import { flushPromises, useMockTime } from '@amazon/vinyl-util/browserTestUtil'
import createSpy = jasmine.createSpy

interface EventA {
    value: number
}

interface EventB {
    value: string
}

interface EventC {
    value: Date
}

interface EventMap {
    readonly eventA: EventA
    readonly eventB: EventB
    readonly eventC: EventC
}

describe('nextEventAsPromise', () => {
    let host: EventHostImpl<EventMap>
    beforeEach(() => {
        host = new EventHostImpl<EventMap>()
    })

    it('resolves when the event is next fired', async () => {
        const promise = nextEventAsPromise(host, 'eventB')
        const spy = createSpy('nextEvent')
        void promise.then(spy)
        expect(spy).not.toHaveBeenCalled()
        host.dispatch('eventA', { value: 1 })
        await flushPromises()
        expect(spy).not.toHaveBeenCalled()
        const event = { value: 'test' } as const
        host.dispatch('eventB', event)
        await flushPromises()
        expect(spy).toHaveBeenCalledOnceWith(event)
    })

    describe('when options.filter is provided', () => {
        it('skips events not passing the given filter', async () => {
            const promise = nextEventAsPromise(host, 'eventB', {
                filter: (event) => {
                    return event.value === 'pass'
                },
            })
            const spy = createSpy('nextEvent')
            void promise.then(spy)
            expect(spy).not.toHaveBeenCalled()
            host.dispatch('eventB', { value: 'test' })
            await flushPromises()
            expect(spy).not.toHaveBeenCalled()
            const event = { value: 'pass' } as const
            host.dispatch('eventB', event)
            await flushPromises()
            expect(spy).toHaveBeenCalledWith(event)
        })
    })

    it('unsubscribes when resolved', async () => {
        const filterSpy = createSpy('filter').and.returnValues(false, true)
        const promise = nextEventAsPromise(host, 'eventB', {
            filter: filterSpy,
        })
        host.dispatch('eventB', { value: 'test' })
        host.dispatch('eventB', { value: 'test' })
        host.dispatch('eventB', { value: 'test' })
        host.dispatch('eventB', { value: 'test' })
        await promise
        expect(filterSpy).toHaveBeenCalledTimes(2)
    })

    describe('when options.abort is provided', () => {
        it('rejects if aborted', async () => {
            const abort = new Abort()
            const promise = nextEventAsPromise(host, 'eventB', {
                abort,
            })
            const error = new Error('reason')
            abort.abort(error)
            await expectAsync(promise).toBeRejectedWith(error)
            host.dispatch('eventB', { value: 'test' })
        })
    })

    describe('when options.timeout is provided', () => {
        const clock = useMockTime()
        it('rejects if the timeout is reached before the event is dispatched', async () => {
            const promise = nextEventAsPromise(host, 'eventA', {
                timeout: 3,
            })
            await clock.tick(2.9)
            await expectAsync(promise).toBePending()
            await clock.tick(0.1)
            await expectAsync(promise).toBeRejectedWithError(
                `Event 'eventA' was not received within 3s`
            )
        })

        it('resolves if the timeout is not reached before the event is dispatched', async () => {
            const promise = nextEventAsPromise(host, 'eventA', {
                timeout: 3,
            })
            await clock.tick(2.9)
            host.dispatch('eventA', { value: 1 })
            await expectAsync(promise).toBeResolvedTo({ value: 1 })
        })

        describe('and options.abort is provided', () => {
            describe('and abort happens before timeout', () => {
                it('rejects with abort reason', async () => {
                    const abort = new Abort()
                    const promise = nextEventAsPromise(host, 'eventA', {
                        timeout: 3,
                        abort,
                    })
                    await clock.tick(2.9)
                    const error = new Error('reason')
                    abort.abort(error)
                    host.dispatch('eventA', { value: 1 })
                    await expectAsync(promise).toBeRejectedWith(error)
                })
            })

            describe('and abort happens after timeout', () => {
                it('rejects with timeout message', async () => {
                    const abort = new Abort()
                    const promise = nextEventAsPromise(host, 'eventA', {
                        timeout: 3,
                        timeoutMessage: 'timeout message',
                        abort,
                    })
                    await expectAsync(promise).toBePending()
                    await clock.tick(3)
                    abort.abort()
                    await expectAsync(promise).toBeRejectedWithError(
                        'timeout message'
                    )
                })
            })
        })
    })
})
