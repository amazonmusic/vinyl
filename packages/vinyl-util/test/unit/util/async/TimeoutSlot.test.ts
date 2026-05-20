/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimeoutSlot } from '@amazon/vinyl-util'
import { useMockTime } from '@amazon/vinyl-util/browserTestUtil'
import createSpy = jasmine.createSpy

describe('TimeoutSlot', () => {
    const clock = useMockTime()

    describe('active', () => {
        it('returns true when a timeout is currently running', () => {
            const t = new TimeoutSlot()
            const spy = createSpy('timeout')
            expect(t.active).toBeFalse()
            t.set(spy, 0.01)
            expect(t.active).toBeTrue()
            t.dispose()
            expect(t.active).toBeFalse()
        })
    })

    describe('set', () => {
        it('initiates a timeout', async () => {
            const t = new TimeoutSlot()
            const spy = createSpy('timeout')
            t.set(spy, 10)
            await clock.tick(9)
            expect(spy).not.toHaveBeenCalled()
            await clock.tick(1)
            expect(spy).toHaveBeenCalledOnceWith()
            spy.calls.reset()
        })

        describe('when there is already a timeout', () => {
            it('cancels the previous timeout', async () => {
                const t = new TimeoutSlot()
                const spy = createSpy('timeout')
                t.set(spy, 1)
                const spy2 = createSpy('timeout')
                t.set(spy2, 1)
                await clock.tick(1)
                expect(spy).not.toHaveBeenCalled()
                expect(spy2).toHaveBeenCalledOnceWith()
            })
        })

        describe('when disposed', () => {
            it('throws a DisposedError', () => {
                const t = new TimeoutSlot()
                t.dispose()
                expect(() => t.set(() => {})).toThrowError(
                    'Instance is disposed'
                )
            })
        })

        describe('when no time is provided', () => {
            it('invokes the timeout on the next frame', async () => {
                const t = new TimeoutSlot()
                const spy = createSpy('timeout')
                t.set(spy)
                await clock.tick()
                expect(spy).toHaveBeenCalledOnceWith()
            })
        })
    })

    describe('clear', () => {
        describe('when there is a timeout', () => {
            it('removes the set timeout', async () => {
                const t = new TimeoutSlot()
                const spy = createSpy('timeout')
                t.set(spy, 1)
                t.clear()
                await clock.tick(1)
                expect(spy).not.toHaveBeenCalled()
            })
        })

        describe('when there is no timeout', () => {
            it('does nothing', () => {
                const t = new TimeoutSlot()
                expect(() => t.clear()).not.toThrow()
            })
        })
    })

    describe('dispose', () => {
        describe('when there is a timeout', () => {
            it('clears the timeout', async () => {
                const t = new TimeoutSlot()
                const spy = createSpy('timeout')
                t.set(spy, 1)
                t.dispose()
                await clock.tick(1)
                expect(spy).not.toHaveBeenCalled()
            })
        })
    })
})
