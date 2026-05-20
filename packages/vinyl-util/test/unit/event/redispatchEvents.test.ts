/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventHostImpl, redispatchEvents } from '@amazon/vinyl-util'
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

describe('redispatchEvents', () => {
    it('redispatches the provided event types from event host', () => {
        const hostA = new EventHostImpl<{
            readonly eventB: EventB
            readonly eventC: EventC
        }>()
        const hostB = new EventHostImpl<EventMap>()
        redispatchEvents(hostA, hostB, ['eventB', 'eventC'] as const)
        const cbB = createSpy()
        const cbC = createSpy()
        hostA.on('eventB', cbB)
        hostA.on('eventC', cbC)

        const eventB = { value: 'test' } as const
        hostB.dispatch('eventB', eventB)
        expect(cbB).toHaveBeenCalledOnceWith(eventB)
        expect(cbC.calls.count()).toEqual(0)
        const eventC = { value: new Date() } as const
        hostB.dispatch('eventC', eventC)
        expect(cbC).toHaveBeenCalledOnceWith(eventC)
    })

    it('provides an unsubscribe method for removing all handlers', () => {
        const hostA = new EventHostImpl<{
            readonly eventB: EventB
            readonly eventC: EventC
        }>()
        const hostB = new EventHostImpl<EventMap>()
        const unsub = redispatchEvents(hostA, hostB, ['eventB', 'eventC'])
        const cbB = createSpy()
        const cbC = createSpy()
        hostA.on('eventB', cbB)
        hostA.on('eventC', cbC)

        unsub()
        hostB.dispatch('eventB', { value: 'test' })
        hostB.dispatch('eventC', { value: new Date() })
        expect(cbB.calls.count()).toEqual(0)
        expect(cbC.calls.count()).toEqual(0)
    })
})
