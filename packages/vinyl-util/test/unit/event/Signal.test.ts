/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { emptySignal, type Unsubscribe } from '@amazon/vinyl-util'
import { signal } from '@amazon/vinyl-util'
import createSpy = jasmine.createSpy

describe('Signals', () => {
    it('invokes handlers when dispatched', () => {
        const s = signal<number>()
        const cb = createSpy()
        s.listen(cb)
        s.dispatch(1)
        expect(cb).toHaveBeenCalledOnceWith(1)
        cb.calls.reset()
        s.dispatch(2)
        expect(cb).toHaveBeenCalledOnceWith(2)
        cb.calls.reset()
        s.dispatch(3)
        expect(cb).toHaveBeenCalledOnceWith(3)
    })

    it('empty checks are correct', () => {
        const s = signal<number>()
        expect(s.empty).toBeTrue()
        const a = s.listen(() => {
            return
        })
        expect(s.empty).toBeFalse()
        a()
        expect(s.empty).toBeTrue()
    })

    it(`does not invoke handlers when subscriptions are disposed`, () => {
        const s = signal<number>()
        const cb = createSpy()
        const a = s.listen(cb)
        s.dispatch(1)
        expect(cb).toHaveBeenCalledOnceWith(1)
        cb.calls.reset()
        s.dispatch(2)
        expect(cb).toHaveBeenCalledOnceWith(2)
        cb.calls.reset()
        a()
        s.dispatch(3)
        s.dispatch(3)
        s.dispatch(3)
        expect(cb.calls.count()).toEqual(0)
    })

    it('invokes all handlers', () => {
        const s = signal<number>()
        const actual: string[] = []
        s.listen((i) => actual.push(`a${i}`))
        s.listen((i) => actual.push(`b${i}`))
        s.listen((i) => actual.push(`c${i}`))
        s.listen((i) => actual.push(`d${i}`))

        s.dispatch(1)
        expect(actual).toEqual(['a1', 'b1', 'c1', 'd1'])
        actual.length = 0
        s.dispatch(2)
        expect(actual).toEqual(['a2', 'b2', 'c2', 'd2'])
    })

    it('invokes once handlers only once', () => {
        const s = signal<number>()
        const cb1 = createSpy()
        s.listen(cb1)
        const cb2 = createSpy()
        s.listen(cb2, { once: true })
        const cb3 = createSpy()
        s.listen(cb3)
        const cb4 = createSpy()
        s.listen(cb4, { once: true })
        const cb5 = createSpy()
        s.listen(cb5)
        s.dispatch(1)
        s.dispatch(2)
        s.dispatch(3)
        expect(cb1.calls.count()).toEqual(3)
        expect(cb2.calls.count()).toEqual(1)
        expect(cb3.calls.count()).toEqual(3)
        expect(cb4.calls.count()).toEqual(1)
        expect(cb5.calls.count()).toEqual(3)
    })

    describe('handles nested operations', () => {
        it('dispatches successfully', () => {
            const s = signal<number>()
            const actual: string[] = []
            s.listen(() => actual.push('a'))
            s.listen(() => actual.push('b'))
            s.listen(() => actual.push('c'))
            s.listen((it) => {
                actual.push('d')
                if (it === 2) s.dispatch(3)
            })
            s.listen(() => actual.push('e'))
            s.dispatch(2)
            expect(actual).toEqual([
                'a',
                'b',
                'c',
                'd',
                'a',
                'b',
                'c',
                'd',
                'e',
                'e',
            ])
        })

        it('removes within handler', () => {
            const s = signal<number>()
            const actual: string[] = []
            const a = s.listen(() => {
                actual.push('a')
            })
            s.listen(() => {
                actual.push('b')
            })
            s.listen(() => {
                actual.push('c')
            })
            let e: Unsubscribe | null = null
            s.listen(() => {
                actual.push('d')
                a()
                e?.call(null)
            })
            e = s.listen(() => {
                actual.push('e')
            })
            s.dispatch(2)
            expect(actual).toEqual(['a', 'b', 'c', 'd'])
            actual.length = 0
            s.dispatch(3)
            expect(actual).toEqual(['b', 'c', 'd'])
        })

        it('removes self handler', () => {
            const s = signal<number>()
            const actual: string[] = []
            s.listen(() => {
                actual.push('a')
            })
            const b = s.listen(() => {
                actual.push('b')
                b()
            })
            s.listen(() => actual.push('c'))

            s.dispatch(2)
            expect(actual).toEqual(['a', 'b', 'c'])
            actual.length = 0
            s.dispatch(3)
            expect(actual).toEqual(['a', 'c'])
        })

        it('adds within handler', () => {
            const s = signal<number>()
            const actual: string[] = []
            s.listen(() => {
                actual.push('a')
            })

            let addedD = false
            s.listen(() => {
                actual.push('b')
                if (!addedD) {
                    addedD = true
                    s.listen(() => actual.push('d'))
                }
            })

            s.listen(() => {
                actual.push('c')
            })

            s.dispatch(2)
            // Expect that the newly added handler is not invoked until the next dispatch:
            expect(actual).toEqual(['a', 'b', 'c'])
            actual.length = 0
            s.dispatch(3)
            expect(actual).toEqual(['a', 'b', 'c', 'd'])
        })
    })

    describe('emptySignal', () => {
        it('does nothing', () => {
            expect(emptySignal.empty).toBeTrue()
            const unsub = emptySignal.listen(() => {})
            expect(emptySignal.empty).toBeTrue()
            unsub()
        })
    })
})
