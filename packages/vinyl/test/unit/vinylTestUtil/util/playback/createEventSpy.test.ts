/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventHostImpl } from '@amazon/vinyl-util'
import { useMockTime } from '@amazon/vinyl-util/browserTestUtil'
import { createEventSpy } from '@amazon/vinyl-util/testUtil'

interface EventMap {
    readonly eventA: { readonly strValue: string }
    readonly eventB: { readonly numValue: number }
}

describe('createEventSpy', () => {
    let host: EventHostImpl<EventMap>
    const clock = useMockTime()

    beforeEach(() => {
        host = new EventHostImpl<EventMap>()
    })

    it('adds a spy listener', () => {
        const eventASpy = createEventSpy(host, 'eventA')
        expect(eventASpy).not.toHaveBeenCalled()
        host.dispatch('eventA', {
            strValue: 'testStr',
        })
        expect(eventASpy).toHaveBeenCalledOnceWith({
            strValue: 'testStr',
        })
    })

    describe('next', () => {
        it('resolves on the next spy call', async () => {
            const eventASpy = createEventSpy(host, 'eventA')
            await expectAsync(eventASpy.next()).toBePending()
            const nextA = eventASpy.next()
            const nextB = eventASpy.next()
            host.dispatch('eventA', {
                strValue: 'testStr',
            })
            await expectAsync(nextA).toBeResolvedTo({
                strValue: 'testStr',
            })
            await expectAsync(nextB).toBeResolvedTo({
                strValue: 'testStr',
            })
            const nextC = eventASpy.next()
            await expectAsync(nextC).toBePending()
            host.dispatch('eventA', {
                strValue: 'testStr2',
            })
            await expectAsync(nextC).toBeResolvedTo({
                strValue: 'testStr2',
            })
        })

        it('rejects after the timeout', async () => {
            const eventASpy = createEventSpy(host, 'eventA')
            let next = eventASpy.next(6)
            await clock.tick(5.9)
            await expectAsync(next).toBePending()
            await clock.tick(0.1)
            await expectAsync(next).toBeRejectedWithError(
                `event 'eventA' has not been dispatched after 6s.`
            )
            next = eventASpy.next(2, '{type}:{timeout}')
            await expectAsync(next).toBePending()
            await clock.tick(2)
            await expectAsync(next).toBeRejectedWithError(`eventA:2`)
        })
    })

    describe('dispose', () => {
        it('removes the event listener', () => {
            const eventASpy = createEventSpy(host, 'eventA')
            expect(host.hasAnyListeners()).toBeTrue()
            eventASpy.dispose()
            expect(host.hasAnyListeners()).toBeFalse()
        })
    })
})
