/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createDisposer,
    disposeAll,
    DisposedError,
    isDisposable,
    ReportableError,
    toDisposable,
} from '@amazon/vinyl-util'
import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'
import createSpy = jasmine.createSpy

describe('disposable', () => {
    describe('isDisposable', () => {
        it('returns true if the object has a no argument dispose function', () => {
            expect(isDisposable({ dispose: () => {} })).toBeTrue()
            expect(isDisposable({ dispose: (_prop: number) => {} })).toBeFalse()
            expect(isDisposable({})).toBeFalse()
            expect(isDisposable(null)).toBeFalse()
            expect(isDisposable(3)).toBeFalse()
        })
    })

    describe('disposeAll', () => {
        it('disposes all disposables provided', () => {
            const a = { dispose: createSpy() }
            const b = { dispose: createSpy() }
            const c = { dispose: createSpy() }
            disposeAll([a, b, c])
            expect(a.dispose).toHaveBeenCalledOnceWith()
            expect(b.dispose).toHaveBeenCalledOnceWith()
            expect(c.dispose).toHaveBeenCalledOnceWith()
        })
    })

    describe('toDisposable', () => {
        it('invokes the provided method on dispose', () => {
            const spy = createSpy('dispose')
            const d = toDisposable(spy)
            expect(spy).not.toHaveBeenCalled()
            d.dispose()
            expect(spy).toHaveBeenCalledOnceWith()
        })
    })

    describe('createDisposer', () => {
        describe('add', () => {
            it('adds a disposable', () => {
                const { dispose, add } = createDisposer()
                const a = add({
                    dispose: createSpy(),
                })
                const b = add({
                    dispose: createSpy(),
                })
                expect(a.dispose).not.toHaveBeenCalled()
                expect(b.dispose).not.toHaveBeenCalled()
                dispose()
                expect(a.dispose.calls.count()).toBe(1)
                expect(b.dispose.calls.count()).toBe(1)
                expect(a.dispose.calls.first().object).toBe(a)
                expect(b.dispose.calls.first().object).toBe(b)
            })

            it('accepts unsub functions', () => {
                const { dispose, add } = createDisposer()
                const a = add(createSpy('a'))
                const b = add(createSpy('b'))
                expect(a).not.toHaveBeenCalled()
                expect(b).not.toHaveBeenCalled()
                dispose()
                expect(a).toHaveBeenCalledOnceWith()
                expect(b).toHaveBeenCalledOnceWith()
            })

            it('accepts null and undefined', () => {
                const { dispose, add } = createDisposer()
                expect(add(null)).toBeNull()
                expect(add(undefined)).toBeUndefined()
                dispose()
            })

            describe('when both a Disposable and function', () => {
                it('uses dispose method', () => {
                    const { dispose, add } = createDisposer()
                    const funSpy = createSpy('fun')
                    const disposeSpy = createSpy('dispose')
                    add(Object.assign(funSpy, { dispose: disposeSpy }))
                    dispose()
                    expect(disposeSpy).toHaveBeenCalledOnceWith()
                    expect(funSpy).not.toHaveBeenCalled()
                })
            })

            it('throws when disposed', () => {
                const { dispose, add } = createDisposer()
                dispose()
                expect(() => add(() => {})).toThrowError(DisposedError)
            })
        })

        describe('disposed', () => {
            it('returns true if disposed.', () => {
                const d = createDisposer()
                expect(d.disposed).toBeFalse()
                d.dispose()
                expect(d.disposed).toBeTrue()
            })
        })

        describe('dispose', () => {
            it('throws a DisposedError if already disposed', () => {
                const { dispose } = createDisposer()
                dispose()
                expect(() => dispose()).toThrowMatching(
                    (e) => e instanceof DisposedError
                )
            })
        })
    })

    describe('DisposedError', () => {
        it('is an instance of IllegalStateError and DisposedError', () => {
            expectPrototype(
                () => new DisposedError('message'),
                DisposedError,
                ReportableError,
                Error
            )
        })

        describe('toStringTag', () => {
            it('returns the name', () => {
                expect(new DisposedError()[Symbol.toStringTag]).toBe(
                    'DisposedError'
                )
            })
        })
    })
})
