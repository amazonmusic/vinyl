/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import createSpy = jasmine.createSpy
import {
    implementEventFakes,
    mockEvent,
    MockEventTarget,
} from '@amazon/vinyl-util/browserTestUtil'

describe('implementEventFakes', () => {
    let target: MockEventTarget

    beforeEach(() => {
        target = new MockEventTarget()
    })

    describe('after callEvents', () => {
        beforeEach(() => {
            implementEventFakes(target)
        })

        it('invokes handlers sequentially when an event is dispatched', () => {
            const all: number[] = []
            target.addEventListener('a', () => all.push(1))
            target.addEventListener('a', () => all.push(2))
            target.addEventListener('a', () => all.push(3))
            target.addEventListener('a', () => all.push(4))
            target.addEventListener('a', () => all.push(5))

            target.dispatchEvent(mockEvent('a'))
            expect(all).toEqual([1, 2, 3, 4, 5])
        })

        it(
            'does not re-add or re-order repeat callbacks when capture/bubble ' +
                'has not changed',
            () => {
                const all: number[] = []
                target.addEventListener('a', () => all.push(1))
                const cb = () => all.push(2)
                target.addEventListener('a', cb)
                target.addEventListener('a', () => all.push(3))
                target.addEventListener('a', () => all.push(4))
                target.addEventListener('a', () => all.push(5))
                target.addEventListener('a', cb)
                target.addEventListener('a', cb, false)
                target.addEventListener('a', cb, { once: true })

                target.dispatchEvent(mockEvent('a'))
                expect(all).toEqual([1, 2, 3, 4, 5])
            }
        )

        it('supports both capturing and bubbling phases for handlers', () => {
            const all: number[] = []
            const cb = () => all.push(1)
            target.addEventListener('a', cb, true)
            target.addEventListener('a', cb, false)

            const e = mockEvent('a')
            target.dispatchEvent(e)
            expect(all).toEqual([1, 1])
        })

        it('eliminates handlers specified to run only once', () => {
            const all: number[] = []
            const cb = () => all.push(1)
            target.addEventListener('a', cb, { once: true })

            const e = mockEvent('a')
            target.dispatchEvent(e)
            target.dispatchEvent(e)
            target.dispatchEvent(e)
            expect(all).toEqual([1])
        })

        it('keeps separate "once" handlers for capture phase', () => {
            const all: number[] = []
            const cb = () => all.push(1)
            target.addEventListener('a', cb, { once: true })
            target.addEventListener('a', cb, { capture: true })

            const e = mockEvent('a')
            target.dispatchEvent(e) // 2
            target.dispatchEvent(e)
            target.dispatchEvent(e)
            expect(all).toEqual([1, 1, 1, 1])
        })

        describe('removeEventListener', () => {
            it('removes specified handlers', () => {
                const cb = createSpy('callback')
                target.addEventListener('a', cb)
                target.removeEventListener('a', cb)
                target.dispatchEvent(mockEvent('a'))
                expect(cb).not.toHaveBeenCalled()
            })

            it('handles capture phase as specified in arguments', () => {
                const cb = createSpy('callback')
                target.addEventListener('a', cb, true)
                target.removeEventListener('a', cb)
                target.dispatchEvent(mockEvent('a'))
                expect(cb).toHaveBeenCalled()
                cb.calls.reset()
                target.removeEventListener('a', cb, true)
                expect(cb).not.toHaveBeenCalled()
                cb.calls.reset()

                target.addEventListener('a', cb, { capture: true })
                target.removeEventListener('a', cb)
                target.dispatchEvent(mockEvent('a'))
                expect(cb).toHaveBeenCalled()
                cb.calls.reset()
                target.removeEventListener('a', cb, { capture: true })
                expect(cb).not.toHaveBeenCalled()
                cb.calls.reset()
            })

            it('does nothing if no event listener is found', () => {
                const cb = createSpy('callback')
                target.addEventListener('b', cb)
                target.addEventListener('c', cb, { capture: false })
                target.removeEventListener('a', () => {})
                target.removeEventListener('c', cb, true)
                target.removeEventListener('c', cb, { capture: true })

                target.dispatchEvent(mockEvent('b'))
                target.dispatchEvent(mockEvent('c'))
                expect(cb).toHaveBeenCalledTimes(2)
            })
        })
    })
})
