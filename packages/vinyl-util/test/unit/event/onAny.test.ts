/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventHostImpl, onAny } from '@amazon/vinyl-util'
import { expectNothing } from '@amazon/vinyl-util/browserTestUtil'
import createSpy = jasmine.createSpy

describe('onAny', () => {
    interface Map {
        readonly a: 'a'
        readonly b: 'b'
        readonly c: 1
        readonly d: 2
    }

    it('adds a handler to all provided types', () => {
        const eventHost = new EventHostImpl<Map>()
        const spy =
            createSpy<(e: 'a' | 1 | 2, type: 'c' | 'd' | 'a') => void>(
                'handler'
            )
        const unsub = onAny(eventHost, ['c', 'd', 'a'], spy)

        eventHost.dispatch('c', 1)
        expect(spy).toHaveBeenCalledOnceWith(1, 'c')
        spy.calls.reset()
        eventHost.dispatch('d', 2)
        expect(spy).toHaveBeenCalledOnceWith(2, 'd')
        spy.calls.reset()
        eventHost.dispatch('a', 'a')
        expect(spy).toHaveBeenCalledOnceWith('a', 'a')
        spy.calls.reset()
        eventHost.dispatch('b', 'b')
        expect(spy).not.toHaveBeenCalled()

        unsub()
        eventHost.dispatch('a', 'a')
        eventHost.dispatch('c', 1)
        eventHost.dispatch('d', 2)
        expect(spy).not.toHaveBeenCalled()
    })

    it('expects the handler to accept the union of all potential events', () => {
        // compile-time type assertion
        const eventHost = new EventHostImpl<Map>()
        onAny(
            eventHost,
            ['c', 'd'],
            // @ts-expect-error Expected type 1 | 2
            (_event: 1) => {}
        )
        onAny(eventHost, ['c', 'd'], (_event: 1 | 2) => {})
        expectNothing()
    })

    describe('when options.once is true', () => {
        it('removes specified handlers after first event', () => {
            const eventHost = new EventHostImpl<Map>()
            const spy =
                createSpy<(event: 'a' | 1 | 2, key: 'a' | 'c' | 'd') => void>(
                    'handler'
                )
            onAny(eventHost, ['c', 'd', 'a'], spy, { once: true })

            eventHost.dispatch('d', 2)
            expect(spy).toHaveBeenCalledOnceWith(2, 'd')
            spy.calls.reset()
            eventHost.dispatch('d', 2)
            eventHost.dispatch('a', 'a')
            eventHost.dispatch('c', 1)
            expect(spy).not.toHaveBeenCalled()
        })
    })
})
