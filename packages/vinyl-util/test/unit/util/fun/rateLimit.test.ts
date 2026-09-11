/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IllegalArgumentError, rateLimit } from '@amazon/vinyl-util'
import {
    createCallbackTimingTest,
    useMockTime,
} from '@amazon/vinyl-util/browserTestUtil'
import createSpy = jasmine.createSpy

describe('rateLimit', () => {
    const clock = useMockTime()

    /**
     * Dashes mean wait 1s, x's mean invoke the rate-limited function. The
     * resolved string shows when the inner function actually runs.
     */
    function createMarbleTest(capacity: number, interval: number) {
        return createCallbackTimingTest(clock, (inner) =>
            rateLimit(inner, { capacity, interval })
        )
    }

    describe('with a capacity of 1', () => {
        it('runs immediately when a token is available and delays the rest', async () => {
            const test = createMarbleTest(1, 2)
            expect(await test('x')).toBe('x')
            // A full bucket allows the leading call; excess calls are delayed,
            // not dropped, one per interval.
            expect(await test('xx')).toBe('x--x')
            expect(await test('xxx')).toBe('x--x--x')
            expect(await test('xxxx')).toBe('x--x--x--x')
            // Spacing calls exactly one interval apart never queues.
            expect(await test('x--x')).toBe('x--x')
            // A call made before the token refills is delayed to the refill.
            expect(await test('x-x')).toBe('x--x')
            // The bucket is full after idling, so a later call is immediate.
            expect(await test('--x')).toBe('--x')
        })
    })

    describe('with a capacity greater than 1', () => {
        it('allows an initial burst, then one call per interval', async () => {
            const test = createMarbleTest(2, 2)
            expect(await test('xx')).toBe('xx')
            expect(await test('xxx')).toBe('xx--x')
            expect(await test('xxxx')).toBe('xx--x--x')
            expect(await test('xxxxx')).toBe('xx--x--x--x')
        })

        it('refills up to capacity while idle for a later burst', async () => {
            const test = createMarbleTest(2, 2)
            // Consume the burst, idle to refill both tokens, then burst again.
            expect(await test('xx----xx')).toBe('xx----xx')
        })
    })

    describe('never drops calls', () => {
        it('eventually invokes every call, only delaying those over the rate', async () => {
            const spy = createSpy('inner')
            const limited = rateLimit(spy, { capacity: 2, interval: 2 })
            for (let i = 0; i < 7; i++) limited()
            // Two ran immediately (the burst); the rest are queued.
            expect(spy).toHaveBeenCalledTimes(2)
            // Drain the queue: five remaining at one per 2s.
            await clock.tick(2, 2, 2, 2, 2)
            expect(spy).toHaveBeenCalledTimes(7)
        })
    })

    describe('invalid options', () => {
        it('throws an IllegalArgumentError for a capacity below 1', () => {
            expect(() =>
                rateLimit(() => {}, { capacity: 0, interval: 1 })
            ).toThrowMatching((e) => e instanceof IllegalArgumentError)
        })

        it('throws an IllegalArgumentError for a non-positive interval', () => {
            expect(() =>
                rateLimit(() => {}, { capacity: 1, interval: 0 })
            ).toThrowMatching((e) => e instanceof IllegalArgumentError)
        })
    })

    describe('reset', () => {
        it('refills the bucket and flushes queued calls immediately', async () => {
            const spy = createSpy('inner')
            const limited = rateLimit(spy, { capacity: 1, interval: 4 })
            limited() // runs (token consumed)
            limited() // queued
            expect(spy).toHaveBeenCalledTimes(1)

            limited.reset()
            // The queued call is flushed immediately.
            expect(spy).toHaveBeenCalledTimes(2)
            // The bucket is full again, so the next call runs immediately.
            limited()
            expect(spy).toHaveBeenCalledTimes(3)
            // Nothing is left pending.
            spy.calls.reset()
            await clock.tick(4)
            expect(spy).not.toHaveBeenCalled()
        })

        it('is a no-op when nothing is queued', () => {
            const spy = createSpy('inner')
            const limited = rateLimit(spy, { capacity: 1, interval: 4 })
            limited() // runs; no queue, no timer
            spy.calls.reset()
            limited.reset()
            expect(spy).not.toHaveBeenCalled()
        })
    })

    describe('dispose', () => {
        it('cancels queued calls', async () => {
            const spy = createSpy('inner')
            const limited = rateLimit(spy, { capacity: 1, interval: 4 })
            limited() // runs
            limited() // queued
            spy.calls.reset()
            limited.dispose()
            await clock.tick(4)
            expect(spy).not.toHaveBeenCalled()
        })

        it('throws when invoked after disposal', () => {
            const limited = rateLimit(() => {}, { capacity: 1, interval: 1 })
            limited.dispose()
            expect(() => limited()).toThrowError('Instance is disposed')
        })
    })
})
