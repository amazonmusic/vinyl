/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Abort,
    AbortError,
    Browser,
    createDisposer,
    Deferred,
    type Disposable,
    DisposedError,
    hasBrowser,
    isPromiseLike,
    promise,
    sleep,
    toDisposablePromise,
} from '@amazon/vinyl-util'
import createSpy = jasmine.createSpy
import spyOnGlobalErrorsAsync = jasmine.spyOnGlobalErrorsAsync

// https://jasmine.github.io/api/4.3/jasmine.html#.spyOnGlobalErrorsAsync

describe('promise', () => {
    it('resolves when resolve is called', async () => {
        await expectAsync(
            promise((resolve) => {
                resolve(1)
            })
        ).toBeResolvedTo(1)
    })

    it('rejects when reject is called', async () => {
        await expectAsync(
            promise((_, reject) => {
                reject(-1)
            })
        ).toBeRejectedWith(-1)
    })

    describe('when provided abort is in an aborted state', () => {
        it('rejects immediately', async () => {
            const abort = new Abort()
            abort.abort(new Error('expected'))
            await expectAsync(promise(() => {}, abort)).toBeRejectedWithError(
                'expected'
            )
        })
    })

    describe('when resolving synchronously within the executor', () => {
        it('invokes a returned cleanup method', async () => {
            const spy = createSpy('unsub')
            await promise((resolve) => {
                resolve(1)
                return spy
            })
            expect(spy).toHaveBeenCalledOnceWith()
        })
    })

    describe('when rejecting synchronously within the executor', () => {
        it('invokes a returned cleanup method', async () => {
            const spy = createSpy('unsub')
            await promise((_, reject) => {
                reject(1)
                return spy
            }).catch(() => {})
            expect(spy).toHaveBeenCalledOnceWith()
        })
    })

    describe('when resolving asynchronously from the executor', () => {
        it('invokes a returned cleanup method', async () => {
            const spy = createSpy('unsub')
            const p = promise((resolve) => {
                setTimeout(() => {
                    resolve(1)
                })
                return spy
            })
            await expectAsync(p).toBeResolvedTo(1)
            expect(spy).toHaveBeenCalledOnceWith()
        })
    })

    describe('when rejecting asynchronously from the executor', () => {
        it('invokes a returned cleanup method', async () => {
            const spy = createSpy('unsub')
            const p = promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('expected'))
                })
                return spy
            })
            await expectAsync(p).toBeRejectedWith(new Error('expected'))
            expect(spy).toHaveBeenCalledOnceWith()
        })
    })

    describe('when there is an unhandled rejection', () => {
        beforeEach(() => {
            if (hasBrowser(Browser.EDGE_LEGACY)) {
                pending('spyOnGlobalErrorsAsync does not work on Edge Legacy')
            }
        })

        it('is considered a global unhandled rejection', async () => {
            await spyOnGlobalErrorsAsync(async function (globalErrorSpy) {
                const expected = new Error('expected')
                void promise((_, reject) => {
                    reject(expected)
                })
                // cannot await the promise, or it won't be considered 'unhandled'
                await sleep(0.1)
                expect(globalErrorSpy).toHaveBeenCalledWith(expected)
            })
        })
    })

    describe('when resolve is invoked multiple times', () => {
        describe('synchronously', () => {
            it('calls cleanup once', async () => {
                const spy = createSpy('unsub')
                await promise((resolve) => {
                    resolve(void 0)
                    resolve(void 0)
                    resolve(void 0)
                    return spy
                })
                expect(spy).toHaveBeenCalledTimes(1)
            })
        })

        describe('asynchronously', () => {
            it('calls cleanup once', async () => {
                const spy = createSpy('unsub')
                await promise((resolve) => {
                    setTimeout(() => {
                        resolve(void 0)
                        resolve(void 0)
                        resolve(void 0)
                    })
                    return spy
                })
                expect(spy).toHaveBeenCalledTimes(1)
            })
        })
    })

    describe('when reject is invoked multiple times', () => {
        describe('synchronously', () => {
            it('calls cleanup once', async () => {
                const spy = createSpy('unsub')
                await promise((_, reject) => {
                    reject(void 0)
                    reject(void 0)
                    reject(void 0)
                    return spy
                }).catch(() => {})
                expect(spy).toHaveBeenCalledTimes(1)
            })
        })

        describe('asynchronously', () => {
            it('calls cleanup once', async () => {
                const spy = createSpy('unsub')
                await promise((_, reject) => {
                    setTimeout(() => {
                        reject(void 0)
                        reject(void 0)
                        reject(void 0)
                    })
                    return spy
                }).catch(() => {})
                expect(spy).toHaveBeenCalledTimes(1)
            })
        })
    })

    describe('isPromiseLike', () => {
        it('detects a native Promise', () => {
            const value = Promise.resolve(123)
            expect(isPromiseLike(value)).toBeTrue()
        })

        it('detects a thenable object', () => {
            const value = { then: () => {} }
            expect(isPromiseLike(value)).toBeTrue()
        })

        it('rejects a non-thenable object', () => {
            // noinspection JSUnusedGlobalSymbols
            const value = { notThen: () => {} }
            expect(isPromiseLike(value)).toBeFalse()
        })

        it('rejects null', () => {
            expect(isPromiseLike(null)).toBeFalse()
        })

        it('rejects undefined', () => {
            expect(isPromiseLike(undefined)).toBeFalse()
        })

        it('rejects a number', () => {
            expect(isPromiseLike(42)).toBeFalse()
        })

        it('rejects a string', () => {
            expect(isPromiseLike('promise')).toBeFalse()
        })

        it('rejects a function', () => {
            const value = () => {}
            expect(isPromiseLike(value)).toBeFalse()
        })
    })

    describe('toDisposablePromise', () => {
        it('resolves and returns the original Disposable', async () => {
            const original = createDisposer()
            const promise = Promise.resolve(original)

            const wrapped = toDisposablePromise(promise)

            const result = await wrapped
            expect(result).toBe(original)
            expect(original.disposed).toBeFalse()
        })

        it('disposes resolved value when dispose is called after resolution', async () => {
            const original = createDisposer()
            const promise = Promise.resolve(original)

            const wrapped = toDisposablePromise(promise)

            const result = await wrapped
            expect(result).toBe(original)
            wrapped.dispose()

            expect(original.disposed).toBeTrue()
        })

        it('aborts promise if dispose is called before resolution', async () => {
            const promise = new Deferred<Disposable>()

            const disposable = createDisposer()
            const wrapped = toDisposablePromise(promise)

            wrapped.dispose()

            // Simulate late resolution
            promise.resolve(disposable)
            await expectAsync(wrapped).toBeRejectedWithError(AbortError)
        })

        it('throws if dispose is called multiple times', async () => {
            const wrapped = toDisposablePromise(
                Promise.resolve(createDisposer())
            )
            await wrapped
            wrapped.dispose()
            expect(() => wrapped.dispose()).toThrowError(DisposedError)
        })

        it('propagates rejection from original promise', async () => {
            const error = new Error('fail')
            const wrapped = toDisposablePromise(Promise.reject(error))
            await expectAsync(wrapped).toBeRejectedWith(error)
        })

        describe('when the resolved value is not disposable', () => {
            it('does not dispose resolved value', async () => {
                {
                    const wrapped = toDisposablePromise(Promise.resolve(3))
                    await wrapped
                    expect(() => wrapped.dispose()).not.toThrowError()
                }
                {
                    const promise = new Deferred<3>()
                    const wrapped = toDisposablePromise(promise)
                    wrapped.dispose()
                    promise.resolve(3)
                    await expectAsync(wrapped).toBeRejectedWithError(AbortError)
                }
            })
        })
    })
})
