/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ThrottleOptions } from '@amazon/vinyl-util'
import { IllegalArgumentError, throttle } from '@amazon/vinyl-util'
import {
    createCallbackTimingTest,
    useMockTime,
} from '@amazon/vinyl-util/browserTestUtil'
import createSpy = jasmine.createSpy

describe('throttle', () => {
    const clock = useMockTime()

    /**
     * Dashes mean wait 1s, x's mean invoke the throttled function.
     */
    function createMarbleTest(duration: number, options?: ThrottleOptions) {
        return createCallbackTimingTest(clock, (inner) =>
            throttle(inner, duration, options)
        )
    }

    describe('when leading is true', () => {
        describe('and trailing is true', () => {
            it('invokes inner at the beginning and ending of the duration window', async () => {
                const test = createMarbleTest(4, {
                    leading: true,
                    trailing: true,
                })
                expect(await test('-x----x')).toBe('-x----x')
                expect(await test('--x----x')).toBe('--x----x')
                expect(await test('x----x')).toBe('x----x')
                expect(await test('--x')).toBe('--x')
                expect(await test('--x-x')).toBe('--x----x')
                expect(await test('--xx')).toBe('--x----x')
                expect(await test('--x--x---x')).toBe('--x----x----x')
                expect(await test('--x-----xxx')).toBe('--x-----x----x')
                expect(await test('--x-x-x-x-x-x-x-x-x-x')).toBe(
                    '--x----x----x----x'
                )
            })
        })

        describe('and trailing is false', () => {
            it('invokes inner at the beginning of the duration window', async () => {
                const test = createMarbleTest(4, {
                    leading: true,
                    trailing: false,
                })
                expect(await test('-x----x')).toBe('-x----x')
                expect(await test('--x----x')).toBe('--x----x')
                expect(await test('x----x')).toBe('x----x')
                expect(await test('xxx----xxx')).toBe('x----x')
                expect(await test('xx-xx-xx-xx')).toBe('x')
                expect(await test('xx-xx-xx-xx---x')).toBe('x------x')
                expect(await test('xx-xx-xx-xx-xx-xx-xxx-xxxx-xx-xxx')).toBe(
                    'x----x----x'
                )
                expect(await test('---x-------x---xx')).toBe('---x-------x')
            })
        })
    })

    describe('when leading is false', () => {
        describe('and trailing is true', () => {
            it('invokes inner at the ending of the duration window', async () => {
                const test = createMarbleTest(4, {
                    leading: false,
                    trailing: true,
                })
                expect(await test('x----x')).toBe('----x----x')
                expect(await test('--x')).toBe('------x')
                expect(await test('-x----x')).toBe('-----x----x')
                expect(await test('--x----x')).toBe('------x----x')
                expect(await test('--x------x')).toBe('------x----x')
                expect(await test('xxx----xxx')).toBe('----x----x')
                expect(await test('x-x-x----x-x-x')).toBe('----x----x----x')
            })
        })

        describe('and trailing is false', () => {
            it('throws an IllegalArgumentError', () => {
                expect(() => throttle(() => {}, 1, {})).toThrowMatching(
                    (e) => e instanceof IllegalArgumentError
                )
                expect(() =>
                    throttle(() => {}, 1, { leading: false, trailing: false })
                ).toThrowMatching((e) => e instanceof IllegalArgumentError)
            })
        })
    })

    describe('with omitted options', () => {
        it('defaults to leading=true, trailing=true', async () => {
            const test = createMarbleTest(2)
            expect(await test('-x--x')).toBe('-x--x')
            expect(await test('--x--x')).toBe('--x--x')
            expect(await test('x--x')).toBe('x--x')
            expect(await test('x-x')).toBe('x--x')
            expect(await test('xx')).toBe('x--x')
        })
    })

    describe('reset', () => {
        it('resets the throttle', () => {
            const spy = createSpy('inner')
            const throttled = throttle(spy, 1, { leading: true })
            throttled()
            spy.calls.reset()
            throttled.reset()
            throttled()
            expect(spy).toHaveBeenCalledOnceWith()
        })

        it('invokes any pending call', async () => {
            const spy = createSpy('inner')
            const throttled = throttle(spy, 1, { trailing: true })
            throttled()
            expect(spy).not.toHaveBeenCalled()
            throttled.reset()
            expect(spy).toHaveBeenCalledOnceWith()
            spy.calls.reset()
            await clock.tick(1)
            expect(spy).not.toHaveBeenCalled()
        })
    })

    describe('dispose', () => {
        it('cancels pending invocations', async () => {
            const spy = createSpy('inner')
            const throttled = throttle(spy, 10, { trailing: true })
            throttled()
            throttled.dispose()
            await clock.tick(10)
            expect(spy).not.toHaveBeenCalled()
        })

        it('prevents inner calls', async () => {
            const spy = createSpy('inner')
            const throttled = throttle(spy, 10, {
                leading: true,
                trailing: true,
            })

            throttled()
            throttled()
            spy.calls.reset()
            throttled.dispose()
            await clock.tick(10)
            expect(spy).not.toHaveBeenCalled()
        })

        it('throws when invoked next', () => {
            const throttled = throttle(() => {}, 1)
            throttled.dispose()
            expect(() => throttled()).toThrowError('Instance is disposed')
        })

        describe('when no timer is active', () => {
            it('does not throw', () => {
                const spy = createSpy('inner')
                const throttled = throttle(spy, 10, {
                    leading: true,
                    trailing: true,
                })
                throttled.dispose()
                expect(spy).not.toHaveBeenCalled()
            })
        })
    })
})
