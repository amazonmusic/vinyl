/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Abort,
    AbortError,
    createAbortController,
    createAbortSlot,
} from '@amazon/vinyl-util'
import {
    MockAbortController,
    MockAbortSignal,
    MockAbortSignalGlobal,
} from '@amazon/vinyl-util/browserTestUtil'
import createSpy = jasmine.createSpy
import objectContaining = jasmine.objectContaining

describe('abort', () => {
    let originalAbortController: any
    let originalAbortSignal: any
    beforeEach(() => {
        originalAbortController = global.AbortController
        originalAbortSignal = global.AbortSignal
    })

    afterEach(() => {
        global.AbortController = originalAbortController
        global.AbortSignal = originalAbortSignal
    })

    describe('createAbortController', () => {
        describe('when AbortController is supported', () => {
            it('returns a new AbortController', () => {
                global.AbortController = MockAbortController
                global.AbortSignal = MockAbortSignalGlobal
                expect(createAbortController()).toBeInstanceOf(AbortController)
            })
        })

        describe('when AbortController is not supported', () => {
            it('returns null', () => {
                global.AbortController = undefined as any
                global.AbortSignal = MockAbortSignalGlobal
                expect(createAbortController()).toBeNull()
            })
        })

        describe('when AbortSignal is not supported', () => {
            it('returns null', () => {
                global.AbortController = MockAbortController
                global.AbortSignal = undefined as any
                expect(createAbortController()).toBeNull()
            })
        })
    })

    describe('Abort', () => {
        let abort: Abort
        beforeEach(() => {
            abort = new Abort()
        })

        it('emits abort on the signal when aborted', () => {
            const spy = createSpy('abort')
            abort.on('abort', spy)
            const error = new Error('reason')
            abort.abort(error)
            expect(spy).toHaveBeenCalledOnceWith(
                objectContaining({
                    reason: error,
                })
            )
            expect(abort.aborted()).toBeTrue()
            // Should no-op the second abort.
            abort.abort()
            expect(spy).toHaveBeenCalledTimes(1)
        })

        it('provides the abort reason', () => {
            const error = new Error('reason')
            abort.abort(error)
            expect(abort.reason).toBe(error)
        })

        it('allows listeners to be removed', () => {
            const spy = createSpy('abort')
            const sub = abort.on('abort', spy)
            sub()
            abort.abort()
            expect(spy).not.toHaveBeenCalled()
        })

        describe('throwIfAborted', () => {
            it('throws if aborted', () => {
                abort.throwIfAborted() // Not aborted yet
                abort.abort()
                expect(() => {
                    abort.throwIfAborted()
                }).toThrow()
            })

            it('throws with the given reason', () => {
                abort.abort(new AbortError())
                expect(() => {
                    abort.throwIfAborted()
                }).toThrowMatching((thrown) => thrown instanceof AbortError)
            })
        })

        describe('onAborted', () => {
            describe('when already aborted', () => {
                it('calls the callback immediately', () => {
                    const reason = new Error()
                    abort.abort(reason)
                    const cb = createSpy('cb')
                    abort.onAborted(cb)
                    expect(cb).toHaveBeenCalledOnceWith({ reason })
                })
            })

            it('calls the callback on abort', () => {
                const reason = new Error()
                const cb = createSpy('cb')
                abort.onAborted(cb)
                expect(cb).not.toHaveBeenCalled()
                abort.abort(reason)
                expect(cb).toHaveBeenCalledOnceWith({ reason })
            })
        })

        describe('nativeSignal', () => {
            it('provides an AbortSignal when native AbortController is supported', () => {
                const abortController = new MockAbortController()
                abortController.signal = new MockAbortSignal()

                const abort = new Abort({
                    abortControllerFactory: () => abortController,
                })
                const signal = abort.nativeSignal
                expect(signal).toBeTruthy()
                const error = new Error('reason')
                abort.abort(error)
                expect(abortController.abort).toHaveBeenCalledTimes(1)
            })

            it('provides a null signal when native AbortController is not supported', () => {
                global.AbortController = undefined as any
                expect(new Abort().nativeSignal).toBeNull()
            })
        })

        describe('when abortControllerFactory dependency is omitted', () => {
            let originalAbortController: any
            let originalAbortSignal: any

            beforeEach(() => {
                originalAbortController = global.AbortController
                originalAbortSignal = global.AbortSignal
                // createAbortController uses AbortController constructor
                global.AbortController = class A extends MockAbortController {
                    constructor() {
                        super()
                        this.signal = new MockAbortSignalGlobal()
                    }
                }
                global.AbortSignal = MockAbortSignalGlobal
            })

            afterEach(() => {
                global.AbortController = originalAbortController
                global.AbortSignal = originalAbortSignal
            })

            it('uses createAbortController', () => {
                const abort = new Abort()
                expect(abort.nativeSignal).toBeInstanceOf(MockAbortSignal)
            })
        })
    })

    describe('createAbortSlot', () => {
        describe('abort', () => {
            it('aborts the current abort signal and creates a new one', () => {
                const abort = createAbortSlot()
                const signal = abort.value
                abort.abort()
                expect(signal.aborted()).toBeTrue()
                expect(abort.value).not.toEqual(signal)
            })
        })
    })
})
