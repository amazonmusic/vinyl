/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AnyRecord } from '@amazon/vinyl-util'
import { EventHostImpl } from '@amazon/vinyl-util'
import createSpy = jasmine.createSpy

interface EventA {
    value: number
}

interface EventB {
    value: string
}

interface EventC {
    value: Date
}

interface EventMap {
    readonly eventA: EventA
    readonly eventB: EventB
    readonly eventC: EventC
}

describe('EventHostImpl', () => {
    describe('logPrefix', () => {
        it('is a value based on Symbol.toStringTag', () => {
            class SubEventHost extends EventHostImpl<AnyRecord> {
                get [Symbol.toStringTag](): string {
                    return 'SubEventHost'
                }
            }
            const s = new SubEventHost()
            expect(s.logPrefix).toContain('SubEventHost')
        })
    })

    describe('hasAnyListeners', () => {
        it('returns true if any listeners are active', () => {
            const host = new EventHostImpl<any>()
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
            const host = new EventHostImpl<any>()
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

    describe('dispatch', () => {
        it('invokes named handlers', () => {
            const host = new EventHostImpl<{
                eventA: EventA
                eventB: EventB
            }>()
            const cbA1 = createSpy()
            const cbA2 = createSpy()
            const cbB1 = createSpy()
            const cbB2 = createSpy()
            host.on('eventA', cbA1)
            host.on('eventA', cbA2)
            host.on('eventB', cbB1)
            host.on('eventB', cbB2)
            const eventA = { value: 32 } as const
            const eventB = { value: 'test' } as const
            host.dispatch('eventA', eventA)
            expect(cbA1).toHaveBeenCalledOnceWith(eventA)
            expect(cbA2).toHaveBeenCalledOnceWith(eventA)
            expect(cbB1.calls.count()).toEqual(0)
            expect(cbB2.calls.count()).toEqual(0)
            cbA1.calls.reset()
            cbA2.calls.reset()
            host.dispatch('eventB', eventB)
            expect(cbB1).toHaveBeenCalledOnceWith(eventB)
            expect(cbB2).toHaveBeenCalledOnceWith(eventB)
            expect(cbA1.calls.count()).toEqual(0)
            expect(cbA2.calls.count()).toEqual(0)
        })
    })

    describe('on', () => {
        it('returns an unsubscribe handle', () => {
            const host = new EventHostImpl<EventMap>()
            const cb = createSpy()
            const unsub = host.on('eventA', cb)
            const eventA = { value: 3 } as const
            unsub()
            host.dispatch('eventA', eventA)
            expect(cb.calls.count()).toEqual(0)
        })
    })

    describe('when options.once is true', () => {
        it('removes handler after first invocation', () => {
            const host = new EventHostImpl<EventMap>()
            const cb = createSpy()
            host.on('eventA', cb, { once: true })
            const eventA = { value: 3 } as const
            host.dispatch('eventA', eventA)
            host.dispatch('eventA', eventA)
            expect(cb.calls.count()).toEqual(1)
        })

        it('returns an unsubscribe handle', () => {
            const host = new EventHostImpl<EventMap>()
            const cb = createSpy()
            const unsub = host.on('eventA', cb, { once: true })
            const eventA = { value: 3 } as const
            unsub()
            host.dispatch('eventA', eventA)
            expect(cb.calls.count()).toEqual(0)
        })
    })

    describe('dispose', () => {
        it('removes handlers', () => {
            const host = new EventHostImpl<EventMap>()
            const cb = createSpy()
            host.on('eventA', cb)
            const eventA = { value: 4 } as const
            host.dispose()
            host.dispatch('eventA', eventA)
            expect(cb.calls.count()).toEqual(0)
        })
    })
})
