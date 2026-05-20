/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Abort,
    AbortError,
    TimeoutController,
    TimeoutError,
} from '@amazon/vinyl-util'
import { useMockTime } from '@amazon/vinyl-util/browserTestUtil'
import createSpy = jasmine.createSpy

describe('TimeoutController', () => {
    const clock = useMockTime()

    afterEach(() => {
        // Cleanup handled by global setup
    })

    describe('when timeout is reached', () => {
        it('aborts with a TimeoutError', async () => {
            const tC = new TimeoutController(10, null, 't: {time}')
            await clock.tick(9)
            expect(tC.aborted()).toBeFalse()
            await clock.tick(1)
            expect(tC.aborted()).toBeTrue()
            expect(tC.reason).toEqual(new TimeoutError('t: 10'))
            tC.dispose()
        })
    })

    describe('abort', () => {
        describe('with no arguments', () => {
            it('aborts with an AbortError', () => {
                const tC = new TimeoutController(10)
                tC.abort()
                expect(tC.aborted()).toBeTrue()
                expect(tC.reason).toEqual(new AbortError())
                tC.dispose()
            })
        })

        it('aborts with the given reason', () => {
            const tC = new TimeoutController(10)
            const reason = new Error('test')
            tC.abort(reason)
            expect(tC.aborted()).toBeTrue()
            expect(tC.reason).toBe(reason)
            tC.dispose()
        })
    })

    describe('when the provided abort state aborts', () => {
        it('cascades the abort reason', () => {
            {
                const abort = new Abort()
                const tC = new TimeoutController(10, abort)
                const error = new Error('cascade')
                abort.abort(error)
                expect(tC.aborted()).toBeTrue()
                expect(tC.reason).toBe(error)
                tC.dispose()
            }
            {
                const abort = new Abort()
                const tC = new TimeoutController(10, abort)
                abort.abort()
                expect(tC.aborted()).toBeTrue()
                expect(tC.reason).toEqual(new AbortError())
                tC.dispose()
            }
        })

        describe('and the provided abort state is aborted', () => {
            it('immediately aborts', () => {
                const abort = new Abort()
                abort.abort()
                const tC = new TimeoutController(10, abort)
                expect(tC.aborted()).toBeTrue()
                expect(tC.reason).toEqual(new AbortError())
                tC.dispose()
            })
        })
    })

    describe('when aborted', () => {
        it('dispatches an abort event', () => {
            const tC = new TimeoutController(10)
            const spy = createSpy('abort')
            tC.on('abort', spy)
            tC.abort()
            expect(spy).toHaveBeenCalledOnceWith({ reason: new AbortError() })
            tC.dispose()
        })
    })

    describe('hasListeners', () => {
        it('returns true if an abort listener is active.', () => {
            const tC = new TimeoutController(10)
            expect(tC.hasAnyListeners()).toBeFalse()
            expect(tC.hasListeners('abort')).toBeFalse()
            const sub = tC.on('abort', () => {})
            expect(tC.hasAnyListeners()).toBeTrue()
            expect(tC.hasListeners('abort')).toBeTrue()
            sub()
            expect(tC.hasAnyListeners()).toBeFalse()
            expect(tC.hasListeners('abort')).toBeFalse()
        })
    })

    describe('throwIfAborted', () => {
        it('throws reason when aborted', () => {
            const tC = new TimeoutController(10)
            expect(() => tC.throwIfAborted()).not.toThrow()
            const error = new Error('reason')
            tC.abort(error)
            expect(() => tC.throwIfAborted()).toThrow(error)
            tC.dispose()
        })
    })

    describe('onAborted', () => {
        it('delegates to the abort', () => {
            const tC = new TimeoutController(10)
            const error = new Error()
            tC.abort(error)
            const spy = createSpy()
            tC.onAborted(spy)
            expect(spy).toHaveBeenCalledOnceWith({ reason: error })
        })
    })

    describe('sleep', () => {
        it('sleeps n seconds', async () => {
            const tC = new TimeoutController(20)
            const p = tC.sleep(10)
            await clock.tick(9)
            await expectAsync(p).toBePending()
            await clock.tick(1)
            await expectAsync(p).toBeResolved()
            tC.dispose()
        })

        it('rejects if controller aborts', async () => {
            const tC = new TimeoutController(10)
            const p = tC.sleep(8)
            await clock.tick(5)
            tC.abort()
            await expectAsync(p).toBeRejectedWith(new AbortError())
            tC.dispose()
        })

        it('rejects immediately if sleep is longer than current timeout', async () => {
            {
                const tC = new TimeoutController(10, null, 't: {time}')
                await expectAsync(tC.sleep(10)).toBeRejectedWithError('t: 10')
                tC.dispose()
            }
            {
                const tC = new TimeoutController(10, null, 't: {time}')
                const s = tC.sleep(5)
                await clock.tick(6)
                await expectAsync(s).toBeResolved()
                await expectAsync(tC.sleep(4.1)).toBeRejectedWithError('t: 10')
                tC.dispose()
            }
        })
    })

    describe('dispose', () => {
        it('unsubscribes from timeouts and cascading abort', async () => {
            const abort = new Abort()
            const unsubSpy = createSpy('unsub')
            spyOn(abort, 'on').and.returnValue(unsubSpy)
            const tC = new TimeoutController(10, abort)
            tC.dispose()
            expect(unsubSpy).toHaveBeenCalledOnceWith()
            await clock.tick(100)
            expect(tC.aborted()).toBeFalse()
            tC.dispose()
        })
    })
})
