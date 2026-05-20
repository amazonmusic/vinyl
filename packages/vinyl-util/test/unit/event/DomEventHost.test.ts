/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DomEventMap } from '@amazon/vinyl-util'
import { DomEventHost } from '@amazon/vinyl-util'
import {
    expectTypeStrictlyEquals,
    mockEvent,
    MockEventTarget,
    implementEventFakes,
} from '@amazon/vinyl-util/browserTestUtil'
import createSpy = jasmine.createSpy

describe('DomEventMap', () => {
    it('extracts string keys', () => {
        expectTypeStrictlyEquals<
            DomEventMap<{
                key: Event
                [3]: Event
            }>,
            {
                key: Event
            }
        >(true)
    })

    it('extracts Event values', () => {
        expectTypeStrictlyEquals<
            DomEventMap<{
                key1: Event
                key2: 3
            }>,
            {
                key1: Event
            }
        >(true)
    })
})

interface CustomEventMap {
    customA: CustomEvent<string>
    eventB: Event
}

describe('DomEventHost', () => {
    describe('hasAnyListeners', () => {
        it('returns true if any listeners are active', () => {
            const host = new DomEventHost<any>(new MockEventTarget())
            expect(host.hasAnyListeners()).toBeFalse()
            const sub1 = host.on('foo', () => {})
            expect(host.hasAnyListeners()).toBeTrue()
            const sub2 = host.on('bar', () => {})
            const sub3 = host.on('baz', () => {})
            const sub4 = host.on('foo', () => {})
            const sub5 = host.on('foo', () => {})
            expect(host.hasAnyListeners()).toBeTrue()
            sub5()
            sub4()
            sub3()
            sub1()
            expect(host.hasAnyListeners()).toBeTrue()
            sub2()
            expect(host.hasAnyListeners()).toBeFalse()
        })
    })

    describe('hasListener', () => {
        it('returns true if there are any active listeners for the given type', () => {
            const host = new DomEventHost<any>(new MockEventTarget())
            expect(host.hasListeners('foo')).toBeFalse()
            const foo1 = host.on('foo', () => {})
            expect(host.hasListeners('foo')).toBeTrue()
            expect(host.hasListeners('bar')).toBeFalse()
            const bar1 = host.on('bar', () => {})
            expect(host.hasListeners('bar')).toBeTrue()
            const baz1 = host.on('baz', () => {})
            const foo2 = host.on('foo', () => {})
            const foo3 = host.on('foo', () => {})
            expect(host.hasListeners('foo')).toBeTrue()
            expect(host.hasListeners('bar')).toBeTrue()
            expect(host.hasListeners('baz')).toBeTrue()
            foo3()
            foo2()
            baz1()
            expect(host.hasListeners('baz')).toBeFalse()
            expect(host.hasListeners('foo')).toBeTrue()
            foo1()
            expect(host.hasListeners('foo')).toBeFalse()
            expect(host.hasListeners('bar')).toBeTrue()
            bar1()
            expect(host.hasListeners('bar')).toBeFalse()
        })
    })

    describe('on', () => {
        it('adds listeners to the event target', () => {
            const target = new MockEventTarget()
            const host = new DomEventHost<CustomEventMap>(target)
            const cb = createSpy()
            host.on('customA', cb)
            host.on('customA', (_event) => {
                // compiler assertion that the event type is what we expect:
                expectTypeStrictlyEquals<typeof _event, CustomEvent<string>>(
                    true
                )
            })
            expect(target.addEventListener).toHaveBeenCalledTimes(2)
            expect(target.addEventListener.calls.argsFor(0)).toEqual([
                'customA',
                cb,
                /* options */ undefined,
            ])
        })

        it('removes callbacks when unsubscribe is called', () => {
            const target = new MockEventTarget()
            const host = new DomEventHost<CustomEventMap>(target)
            const cb = createSpy()
            const unsub = host.on('customA', cb)
            unsub()
            expect(target.removeEventListener).toHaveBeenCalledOnceWith(
                'customA',
                cb,
                /* options */ undefined
            )
        })

        it('accepts event listener init options', () => {
            const target = new MockEventTarget()
            const host = new DomEventHost<CustomEventMap>(target)
            const cb = createSpy()
            host.on('customA', cb, { capture: true })
            expect(target.addEventListener).toHaveBeenCalledOnceWith(
                'customA',
                cb,
                {
                    capture: true,
                }
            )
        })

        it('removes once listeners after being called', () => {
            const target = new MockEventTarget()
            implementEventFakes(target)
            const host = new DomEventHost<any>(target)
            const cb = createSpy('callback')
            host.on('customA', cb, { once: true })
            expect(host.hasAnyListeners()).toBeTrue()
            target.dispatchEvent(mockEvent('customA'))
            expect(cb).toHaveBeenCalledTimes(1)
            cb.calls.reset()
            expect(host.hasAnyListeners()).toBeFalse()
            target.dispatchEvent(mockEvent('customA'))
            expect(cb).not.toHaveBeenCalled()
        })
    })

    describe('dispose', () => {
        it('removes all listeners', () => {
            const target = new MockEventTarget()
            implementEventFakes(target)
            const host = new DomEventHost<any>(target)
            const cb = createSpy('callback')
            host.on('customA', cb)
            host.on('customB', cb)
            host.on('customB', cb)
            host.on('customC', cb)
            host.dispose()

            target.dispatchEvent(mockEvent('customA'))
            target.dispatchEvent(mockEvent('customB'))
            target.dispatchEvent(mockEvent('customC'))
            expect(cb).not.toHaveBeenCalled()
            expect(host.hasAnyListeners()).toBeFalse()
            expect(host.hasListeners('customA')).toBeFalse()
            expect(host.hasListeners('customB')).toBeFalse()
            expect(host.hasListeners('customC')).toBeFalse()
        })
    })
})
