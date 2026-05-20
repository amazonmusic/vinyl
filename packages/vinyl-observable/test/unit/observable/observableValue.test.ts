/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    InferObservableValueType,
    MutableValueImpl,
} from '@amazon/vinyl-observable'
import {
    asData,
    data,
    externalData,
    ExternalMutableValue,
    isObservableValue,
    type MutableValue,
    type ObservableValue,
} from '@amazon/vinyl-observable'
import { DisposedError, noop, type Unsubscribe } from '@amazon/vinyl-util'
import {
    expectTypeExtends,
    expectTypeStrictlyEquals,
} from '@amazon/vinyl-util/browserTestUtil'
import createSpy = jasmine.createSpy

describe('data', () => {
    describe('MutableValueImpl', () => {
        describe('onData', () => {
            it('invokes callback immediately and on value change', () => {
                const d = data(1)
                const callback = createSpy('callback')
                d.onData(callback)
                expect(callback).toHaveBeenCalledWith(1, undefined)

                d.value = 2
                expect(callback).toHaveBeenCalledWith(2, 1)
            })

            it('does not call callback if value is unchanged', () => {
                const d = data('a')
                const callback = createSpy('callback')
                d.onData(callback)
                callback.calls.reset()

                d.value = 'a'
                expect(callback).not.toHaveBeenCalled()
            })

            it('removes callback after unsubscribe', () => {
                const d = data('x')
                const callback = createSpy('callback')
                const unsub = d.onData(callback)
                unsub()

                d.value = 'y'
                expect(callback).not.toHaveBeenCalledWith('y', 'x')
            })

            it('throws error if disposed before subscribing', () => {
                const d = data('dead')
                d.dispose()
                expect(() => d.onData(() => {})).toThrowError(DisposedError)
            })

            it('handles concurrent removal of subscribers', () => {
                const d = data('x')
                const cb1 = createSpy('cb1')
                d.onData(cb1)
                const cb2 = createSpy('cb2')
                const sub2 = d.onData(
                    cb2.and.callFake((v) => {
                        if (v === 'y') sub2()
                    })
                )
                const cb3 = createSpy('cb3')
                d.onData(cb3)

                cb1.calls.reset()
                cb2.calls.reset()
                cb3.calls.reset()
                d.value = 'y'
                expect(cb1).toHaveBeenCalledTimes(1)
                expect(cb2).toHaveBeenCalledTimes(1)
                expect(cb3).toHaveBeenCalledTimes(1)
                cb1.calls.reset()
                cb2.calls.reset()
                cb3.calls.reset()
                d.value = 'z'
                expect(cb1).toHaveBeenCalledTimes(1)
                expect(cb2).toHaveBeenCalledTimes(0)
                expect(cb3).toHaveBeenCalledTimes(1)
            })

            it('handles concurrent addition of subscribers', () => {
                const d = data('x')
                const cb1 = createSpy('cb1')
                d.onData(cb1)
                const cb2 = createSpy('cb2')
                const cb3 = createSpy('cb3')
                d.onData(
                    cb2.and.callFake((v) => {
                        if (v === 'y') d.onData(cb3)
                    })
                )

                cb1.calls.reset()
                cb2.calls.reset()
                cb3.calls.reset()
                d.value = 'y'
                expect(cb1).toHaveBeenCalledTimes(1)
                expect(cb2).toHaveBeenCalledTimes(1)
                expect(cb3).toHaveBeenCalledTimes(1)
                cb1.calls.reset()
                cb2.calls.reset()
                cb3.calls.reset()
                d.value = 'z'
                expect(cb1).toHaveBeenCalledTimes(1)
                expect(cb2).toHaveBeenCalledTimes(1)
                expect(cb3).toHaveBeenCalledTimes(1)
            })
        })

        describe('value getter and setter', () => {
            it('returns current value from getter', () => {
                const d = data(100)
                expect(d.getValue()).toBe(100)
                d.setValue(200)
                expect(d.getValue()).toBe(200)
            })

            it('throws error if setting value inside onData', () => {
                const d = data(1)
                d.onData((value) => {
                    if (value === 2) {
                        expect(() => {
                            d.value = 3
                        }).toThrowError(
                            'data cannot be set from onData callback'
                        )
                    }
                })
                d.value = 2
            })

            it('throws error when setting value after dispose', () => {
                const d = data(42)
                d.dispose()
                expect(() => {
                    d.value = 43
                }).toThrowError(DisposedError)
            })
        })

        describe('invalidate', () => {
            it('re-triggers callback with same value', () => {
                const d = data(10)
                const callback = createSpy('callback')
                d.onData(callback)
                callback.calls.reset()

                d.invalidate()
                expect(callback).toHaveBeenCalledWith(10, 10)
            })
        })

        describe('hasAnyListeners', () => {
            it('returns false when no listeners are registered', () => {
                const d = data(1)
                expect(d.hasAnyListeners()).toBeFalse()
            })

            it('returns true when listeners are registered', () => {
                const d = data(1)
                d.onData(() => {})
                expect(d.hasAnyListeners()).toBeTrue()
            })

            it('returns false after all listeners are unsubscribed', () => {
                const d = data(1)
                const unsub = d.onData(() => {})
                unsub()
                expect(d.hasAnyListeners()).toBeFalse()
            })
        })

        describe('changeId', () => {
            it('starts at 0', () => {
                const d = data(1)
                expect(d.changeId).toBe(0)
            })

            it('increments on value change', () => {
                const d = data(1)
                d.value = 2
                expect(d.changeId).toBe(1)
                d.value = 3
                expect(d.changeId).toBe(2)
            })

            it('does not increment when value is unchanged', () => {
                const d = data(1)
                d.value = 1
                expect(d.changeId).toBe(0)
            })

            it('increments on invalidate', () => {
                const d = data(1)
                d.invalidate()
                expect(d.changeId).toBe(1)
            })

            it('is incremented before callbacks fire', () => {
                const d = data(1)
                let idDuringCallback = -1
                d.onData((v) => {
                    if (v === 2) idDuringCallback = d.changeId
                })
                d.value = 2
                expect(idDuringCallback).toBe(1)
            })
        })

        describe('dispose', () => {
            it('clears all callbacks and marks disposed', () => {
                const d = data('z')
                const callback = createSpy('callback')
                d.onData(callback)
                d.dispose()
                expect(d.disposed).toBeTrue()

                expect(() => (d.value = 'a')).toThrowError(DisposedError)
                expect(() => d.onData(callback)).toThrowError(DisposedError)
            })
        })

        describe('map', () => {
            it('creates reactive transformed sub-value', () => {
                const d = data({ count: 1 })
                const sub = d.map(
                    (obj) => obj.count,
                    (c, o) => ({ ...o, count: c })
                )

                const callback = createSpy('callback')
                sub.onData(callback)
                expect(callback).toHaveBeenCalledOnceWith(1, undefined)
                callback.calls.reset()

                expect(sub.value).toBe(1)
                sub.value = 2
                expect(callback).toHaveBeenCalledOnceWith(2, 1)
                expect(d.value.count).toBe(2)

                callback.calls.reset()
                sub.invalidate()
                expect(callback).toHaveBeenCalledOnceWith(2, 2)
            })

            it('throws if setData is not provided for writable', () => {
                const d = data(1)
                const sub = d.map((x) => x + 1) // Read-only map

                expect(sub.value).toBe(2)
                expect(() => {
                    sub.value = 5
                }).toThrowError(/set.*must be provided/)
            })

            it('calls getter once per onData notification', () => {
                const d = data(1)
                const getter = createSpy('getter').and.callFake(
                    (x: number) => x * 2
                )
                const sub = d.map(getter)

                getter.calls.reset()
                const callback = createSpy('callback')
                sub.onData(callback)
                // Initial onData call: getter called once
                expect(getter).toHaveBeenCalledTimes(1)
                expect(callback).toHaveBeenCalledOnceWith(2, undefined)

                getter.calls.reset()
                callback.calls.reset()
                d.value = 3
                // Value change: getter called once
                expect(getter).toHaveBeenCalledTimes(1)
                expect(callback).toHaveBeenCalledOnceWith(6, 2)
            })

            it('does not call getter again when value is accessed after onData', () => {
                const d = data(1)
                const getter = createSpy('getter').and.callFake(
                    (x: number) => x * 2
                )
                const sub = d.map(getter)
                sub.onData(noop)

                getter.calls.reset()
                d.value = 5
                // getter called once for onData
                expect(getter).toHaveBeenCalledTimes(1)

                getter.calls.reset()
                // .value should use cached result
                expect(sub.value).toBe(10)
                expect(getter).toHaveBeenCalledTimes(0)
            })

            it('exposes changeId from source', () => {
                const d = data(1)
                const sub = d.map((x) => x * 2)
                expect(sub.changeId).toBe(0)
                d.value = 2
                expect(sub.changeId).toBe(1)
            })
        })

        describe('pick', () => {
            it('gets and sets specific property by key', () => {
                const d = data({ foo: 1, bar: 2 })
                const foo = d.pick('foo')

                expect(foo.value).toBe(1)
                foo.value = 42
                expect(d.value.foo).toBe(42)
            })

            describe('when parent object is nullish', () => {
                it('returns undefined value and no-ops set', () => {
                    type Data = { x: number } | undefined
                    const d = data<Data>(undefined)
                    const picked = d.pick('x')
                    expect(picked.value).toBeUndefined()
                    picked.value = 3
                    expect(picked.value).toBeUndefined()
                })
            })
        })

        it('is assignable to ObservableValue', () => {
            interface Animal {
                name: string
            }
            interface Cat extends Animal {
                meow(): void
            }

            expectTypeExtends<
                MutableValueImpl<number>,
                ObservableValue<number>
            >(true)
            expectTypeExtends<
                ObservableValue<number>,
                MutableValueImpl<number>
            >(false)

            expectTypeExtends<ObservableValue<Cat>, ObservableValue<Animal>>(
                true
            )
            expectTypeExtends<MutableValue<Cat>, MutableValue<Animal>>(true)
            expectTypeExtends<
                MutableValue<Cat | null>,
                MutableValue<Animal | null>
            >(true)
            expectTypeExtends<MutableValue<Cat | null>, ObservableValue<any>>(
                true
            )
            expectTypeExtends<MutableValue<Cat>, ObservableValue<Animal>>(true)
            expectTypeExtends<ObservableValue<Cat>, MutableValueImpl<Cat>>(
                false
            )

            expectTypeExtends<MutableValue<Cat>, MutableValue<Animal | null>>(
                true
            )
            expectTypeExtends<MutableValue<Cat | null>, MutableValue<Animal>>(
                false
            )

            // any / unknown cases
            expectTypeExtends<MutableValue<Cat>, MutableValue<unknown>>(true)
            expectTypeExtends<MutableValue<Cat>, ObservableValue<unknown>>(true)
            expectTypeExtends<MutableValue<Cat>, ObservableValue<any>>(true)
            expectTypeExtends<ObservableValue<any>, ObservableValue<Cat>>(true)
        })
    })
})

describe('asData', () => {
    it('returns input if already observable', () => {
        const d = data('x')
        expect(asData(d)).toBe(d)
    })

    it('wraps plain value into MutableValueImpl', () => {
        const wrapped = asData(123)
        expect(wrapped.value).toBe(123)
    })
})

describe('isObservableValue', () => {
    it('returns true for object with onData function', () => {
        const d = data('yes')
        expect(isObservableValue(d)).toBeTrue()
    })

    it('returns false for non-object values', () => {
        expect(isObservableValue(null)).toBeFalse()
        expect(isObservableValue(undefined)).toBeFalse()
        expect(isObservableValue(123)).toBeFalse()
        expect(isObservableValue('str')).toBeFalse()
    })

    it('returns false for objects without onData', () => {
        expect(isObservableValue({})).toBeFalse()
        expect(isObservableValue({ onData: 5 })).toBeFalse()
    })
})

describe('externalData', () => {
    it('returns the initial value from the value getter', () => {
        const provider = externalData(42, () => () => {})
        expect(provider.value).toBe(42)
    })

    it('reflects updated values via external setData', () => {
        let capturedSet: ((v: string) => void) | undefined
        const unsub = createSpy('unsubscribe')

        const provider = externalData('init', (set) => {
            capturedSet = set
            return unsub
        })

        const cb = createSpy('cb')
        const off = provider.onData(cb)

        capturedSet?.('updated')
        expect(provider.value).toBe('updated')

        off()
    })

    it('subscribes only when first callback is registered', () => {
        let externalCallback: ((v: number) => void) | undefined
        const subscribe = createSpy('subscribe')
        subscribe.and.callFake((set: (v: number) => void): Unsubscribe => {
            externalCallback = set
            return createSpy('unsubscribe')
        })

        const ext = externalData(0, subscribe)
        expect(subscribe).not.toHaveBeenCalled()

        const cb = createSpy('cb')
        const unsub = ext.onData(cb)

        expect(subscribe).toHaveBeenCalled()
        expect(cb).toHaveBeenCalledWith(0, undefined)

        externalCallback!(5)
        expect(cb).toHaveBeenCalledWith(5, 0)

        unsub()
        expect(subscribe.calls.count()).toBe(1)
    })

    it('does not support direct mutation', () => {
        const provider = new ExternalMutableValue('abc', () => noop)
        const callback = createSpy('callback')

        provider.onData(callback)
        callback.calls.reset()

        expect(() => provider.invalidate()).toThrowError()

        expect(() => (provider.value = 'def')).toThrowError()
    })

    it('exposes changeId from internal data', () => {
        let capturedSet: ((v: number) => void) | undefined
        const provider = externalData(0, (set) => {
            capturedSet = set
            return noop
        })
        expect(provider.changeId).toBe(0)
        provider.onData(noop)
        capturedSet!(1)
        expect(provider.changeId).toBe(1)
    })
})

describe('InferObservableValueType', () => {
    it('infers the parameterized type T', () => {
        expectTypeStrictlyEquals<
            InferObservableValueType<ObservableValue<number>>,
            number
        >(true)
    })
})
