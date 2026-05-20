/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Lazy, noop } from '@amazon/vinyl-util'
import { DisposedError, IllegalStateError, lazy } from '@amazon/vinyl-util'
import createSpy = jasmine.createSpy
import Spy = jasmine.Spy

describe('lazy', () => {
    let factory: Spy<() => { dispose: Spy }>
    beforeEach(() => {
        factory = createSpy('factory', () => {
            return {
                dispose: createSpy(),
            }
        }).and.callThrough()
    })

    describe('constructed', () => {
        it('returns true if get() was called', () => {
            const lazyVal = lazy(() => undefined)
            expect(lazyVal.constructed).toBeFalse()
            noop(lazyVal.value)
            expect(lazyVal.constructed).toBeTrue()
        })
    })

    describe('value', () => {
        it('constructs and subsequently returns the value from the factory', () => {
            const lazyVal = lazy(factory)
            expect(factory).not.toHaveBeenCalled()
            const first = lazyVal.value
            expect(first).toBeDefined()
            expect(lazyVal.value).toBe(first)
            expect(lazyVal.value).toBe(first)
            expect(lazyVal.value).toBe(first)
            expect(factory.calls.count()).toBe(1)
        })

        describe('when constructing', () => {
            it('throws an IllegalStateError', () => {
                const lazyVal: Lazy<number> = lazy(() => {
                    return lazyVal.value
                })
                expect(() => lazyVal.value).toThrowMatching(
                    (e) => e instanceof IllegalStateError
                )
            })
        })

        describe('when set', () => {
            describe('when disposed', () => {
                it('throws a disposed error', () => {
                    const lazyVal = lazy(factory)
                    lazyVal.dispose()
                    expect(() => (lazyVal.value = factory())).toThrowMatching(
                        (e) => e instanceof DisposedError
                    )
                })
            })

            describe('when constructed', () => {
                it('clears and disposes previous value', () => {
                    const lazyVal = lazy(factory)
                    const previous = lazyVal.value
                    lazyVal.value = factory()
                    expect(previous.dispose).toHaveBeenCalledOnceWith()
                })
            })

            it('sets a new value on the lazy instance', () => {
                const lazyVal = lazy(factory)
                noop(lazyVal.value)
                const newValue = factory()
                lazyVal.value = newValue
                expect(lazyVal.value).toBe(newValue)
                expect(lazyVal.constructed).toBeTrue()
            })
        })
    })

    describe('clear', () => {
        it('disposes the instance', () => {
            const lazyVal = lazy(factory)
            const val = lazyVal.value
            expect(val).toBeDefined()
            expect(lazyVal.value).toBe(val)
            expect(factory).toHaveBeenCalledOnceWith()
            expect(val.dispose).not.toHaveBeenCalled()
            lazyVal.clear()
            expect(val.dispose).toHaveBeenCalled()
            factory.calls.reset()
            expect(lazyVal.value).toBeDefined()
            expect(factory).toHaveBeenCalledOnceWith()
        })

        describe('when the lazy instance is not disposed', () => {
            it('allows the factory to construct again', () => {
                const lazyVal = lazy(factory)
                expect(lazyVal.value).toBeDefined()
                factory.calls.reset()
                lazyVal.clear()
                expect(lazyVal.value).toBeDefined()
                expect(factory).toHaveBeenCalledOnceWith()
            })
        })

        describe('when the lazy instance is disposed', () => {
            it('allows the factory to construct again', () => {
                const lazyVal = lazy(factory)
                expect(lazyVal.value).toBeDefined()
                factory.calls.reset()
                lazyVal.dispose()
                lazyVal.clear()
                expect(lazyVal.value).toBeDefined()
                expect(factory).toHaveBeenCalledOnceWith()
            })
        })

        describe('when the lazy instance is not constructed', () => {
            it('allows the factory to construct again', () => {
                const lazyVal = lazy(factory)
                lazyVal.clear()
                expect(lazyVal.value).toBeDefined()
                expect(factory).toHaveBeenCalledOnceWith()
            })
        })
    })

    describe('dispose', () => {
        it('throws a DisposedError if get() or dispose() is called again', () => {
            const lazyVal = lazy(factory)
            expect(lazyVal.value).toBeDefined()
            expect(factory.calls.count()).toBe(1)
            lazyVal.dispose()
            expect(() => lazyVal.value).toThrowMatching(
                (e) => e instanceof DisposedError
            )
            expect(() => lazyVal.dispose()).toThrowMatching(
                (e) => e instanceof DisposedError
            )
        })

        it('does nothing if the instance has not constructed', () => {
            const lazyVal = lazy(factory)
            lazyVal.dispose()
            expect(factory).not.toHaveBeenCalled()
        })

        it('invokes dispose on the instance if it is disposable', () => {
            const disposable = {
                dispose: createSpy(),
            }
            const lazyRef = lazy(() => disposable)
            noop(lazyRef.value)
            lazyRef.dispose()
            expect(disposable.dispose).toHaveBeenCalledOnceWith()
        })
    })
})
