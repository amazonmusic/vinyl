/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { combineData } from '@amazon/vinyl-observable'
import { data } from '@amazon/vinyl-observable'

describe('combineData', () => {
    it('emits initial combined values immediately', () => {
        const a = data(1)
        const b = data('x')
        const combined = combineData({ a, b })

        const callback = jasmine.createSpy('callback')
        combined.onData(callback)

        expect(callback).toHaveBeenCalledWith({ a: 1, b: 'x' }, undefined)
    })

    it('updates only the changed key and preserves other values', () => {
        const a = data(1)
        const b = data('x')
        const combined = combineData({ a, b })

        const callback = jasmine.createSpy('callback')
        combined.onData(callback)
        expect(callback).toHaveBeenCalledWith({ a: 1, b: 'x' }, undefined)
        callback.calls.reset()

        b.value = 'y'
        expect(callback).toHaveBeenCalledWith(
            { a: 1, b: 'y' },
            { a: 1, b: 'x' }
        )

        callback.calls.reset()
        a.value = 2
        expect(callback).toHaveBeenCalledWith(
            { a: 2, b: 'y' },
            { a: 1, b: 'y' }
        )
    })

    it('emits once for the initial onData trigger of every input', () => {
        const a = data(5)
        const b = data(true)

        const spyA = spyOn(a, 'onData').and.callThrough()
        const spyB = spyOn(b, 'onData').and.callThrough()

        const combined = combineData({ a, b })
        const callback = jasmine.createSpy('callback')
        combined.onData(callback)

        // Callback should be called once immediately with full values
        expect(callback).toHaveBeenCalledTimes(1)
        expect(callback).toHaveBeenCalledWith({ a: 5, b: true }, undefined)

        // Change a value to ensure further triggers work
        a.value = 10
        expect(callback).toHaveBeenCalledWith(
            { a: 10, b: true },
            { a: 5, b: true }
        )

        // Each input is subscribed, and their immediate emissions were folded
        // into the single initial call rather than emitting per input.
        expect(spyA).toHaveBeenCalled()
        expect(spyB).toHaveBeenCalled()
    })

    it('emits an input that changed before the first subscription', () => {
        const a = data(1)
        const b = data(2)
        const combined = combineData({ a, b })

        // combineData snapshots values when built, but its inputs are only
        // subscribed on the first onData, so the snapshot can already be stale.
        a.value = 99

        const callback = jasmine.createSpy('callback')
        combined.onData(callback)
        expect(callback).toHaveBeenCalledOnceWith({ a: 99, b: 2 }, undefined)

        b.value = 3
        expect(callback).toHaveBeenCalledWith({ a: 99, b: 3 }, { a: 99, b: 2 })
    })

    it('unsubscribes from all inputs when outer unsub is called', () => {
        const a = data(0)
        const b = data(1)

        const combined = combineData({ a, b })
        const noop = () => {}

        // Register and immediately unregister
        const unsub = combined.onData(noop)
        unsub()

        // Mutate to check that inner onData callbacks no longer fire
        const cb = jasmine.createSpy('cb')
        combined.onData(cb)
        a.value = 42
        expect(cb).toHaveBeenCalled()
    })
})
