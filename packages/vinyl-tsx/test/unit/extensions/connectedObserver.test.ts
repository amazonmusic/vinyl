/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeConnectedObserver, onConnect } from '@amazon/vinyl-tsx'
import { installDomPolyfill } from '../domPolyfill'

import createSpy = jasmine.createSpy

describe('connectedObserver', () => {
    const dom = installDomPolyfill()

    describe('initializeConnectedObserver', () => {
        it('dispatches connect events on added nodes', () => {
            const unsub = initializeConnectedObserver()
            const element = dom.createElement('div')
            const connectSpy = createSpy('connect')
            element.addEventListener('connect', connectSpy)

            dom.simulateConnect(dom.document, element)
            expect(connectSpy).toHaveBeenCalled()
            unsub()
        })

        it('dispatches disconnect events on removed nodes', () => {
            const unsub = initializeConnectedObserver()
            const element = dom.createElement('div')
            const disconnectSpy = createSpy('disconnect')
            element.addEventListener('disconnect', disconnectSpy)

            dom.simulateConnect(dom.document, element)
            dom.simulateDisconnect(dom.document, element)
            expect(disconnectSpy).toHaveBeenCalled()
            unsub()
        })

        it('skips reordered nodes', () => {
            const unsub = initializeConnectedObserver()
            const element = dom.createElement('div')
            const connectSpy = createSpy('connect')
            const disconnectSpy = createSpy('disconnect')
            element.addEventListener('connect', connectSpy)
            element.addEventListener('disconnect', disconnectSpy)

            // Simulate a reorder: both added and removed in same mutation batch
            const observer = dom.FakeMutationObserver.instances[0]
            observer.trigger([
                { addedNodes: [element], removedNodes: [element] },
            ])

            expect(connectSpy).not.toHaveBeenCalled()
            expect(disconnectSpy).not.toHaveBeenCalled()
            unsub()
        })

        it('dispatches connect on child nodes depth first', () => {
            const unsub = initializeConnectedObserver()
            const parent = dom.createElement('div')
            const child = dom.createElement('span')
            parent.appendChild(child)

            const events: string[] = []
            child.addEventListener('connect', () => events.push('child'))
            parent.addEventListener('connect', () => events.push('parent'))

            dom.simulateConnect(dom.document, parent)
            expect(events).toEqual(['child', 'parent'])
            unsub()
        })

        it('returns an unsubscribe function that disconnects the observer', () => {
            const unsub = initializeConnectedObserver()
            const observer = dom.FakeMutationObserver.instances[0]
            unsub()

            const element = dom.createElement('div')
            const connectSpy = createSpy('connect')
            element.addEventListener('connect', connectSpy)

            observer.trigger([{ addedNodes: [element], removedNodes: [] }])
            expect(connectSpy).not.toHaveBeenCalled()
        })
    })

    describe('onConnect', () => {
        it('invokes callback when node connects', () => {
            initializeConnectedObserver()
            const element = dom.createElement('div')
            const callback = createSpy('callback')

            onConnect(element, callback)
            dom.simulateConnect(dom.document, element)
            expect(callback).toHaveBeenCalledWith(element)
        })

        it('invokes callback immediately if already connected', () => {
            initializeConnectedObserver()
            const element = dom.createElement('div')
            element.isConnected = true
            const callback = createSpy('callback')

            onConnect(element, callback)
            expect(callback).toHaveBeenCalledWith(element)
        })

        it('invokes unsubscribe returned by callback on disconnect', () => {
            initializeConnectedObserver()
            const element = dom.createElement('div')
            const innerUnsub = createSpy('innerUnsub')
            const callback = jasmine
                .createSpy('callback')
                .and.returnValue(innerUnsub)

            onConnect(element, callback)
            dom.simulateConnect(dom.document, element)
            dom.simulateDisconnect(dom.document, element)
            expect(innerUnsub).toHaveBeenCalled()
        })

        it('handles callback returning void on disconnect', () => {
            initializeConnectedObserver()
            const element = dom.createElement('div')
            const callback = jasmine
                .createSpy('callback')
                .and.returnValue(undefined)

            onConnect(element, callback)
            dom.simulateConnect(dom.document, element)
            expect(() =>
                dom.simulateDisconnect(dom.document, element)
            ).not.toThrow()
        })

        it('returns an unsubscribe function that removes listeners', () => {
            initializeConnectedObserver()
            const element = dom.createElement('div')
            const callback = createSpy('callback')

            const unsub = onConnect(element, callback)
            unsub()

            dom.simulateConnect(dom.document, element)
            expect(callback).not.toHaveBeenCalled()
        })

        it('cleans up active subscription when unsubscribed while connected', () => {
            initializeConnectedObserver()
            const element = dom.createElement('div')
            const innerUnsub = createSpy('innerUnsub')
            const callback = jasmine
                .createSpy('callback')
                .and.returnValue(innerUnsub)

            const unsub = onConnect(element, callback)
            dom.simulateConnect(dom.document, element)
            expect(callback).toHaveBeenCalled()
            expect(innerUnsub).not.toHaveBeenCalled()

            unsub()
            expect(innerUnsub).toHaveBeenCalledTimes(1)
        })

        it('does not double-invoke inner cleanup on disconnect after unsubscribe', () => {
            initializeConnectedObserver()
            const element = dom.createElement('div')
            const innerUnsub = createSpy('innerUnsub')
            const callback = jasmine
                .createSpy('callback')
                .and.returnValue(innerUnsub)

            const unsub = onConnect(element, callback)
            dom.simulateConnect(dom.document, element)
            unsub()

            dom.simulateDisconnect(dom.document, element)
            expect(innerUnsub).toHaveBeenCalledTimes(1)
        })

        it('does not double-invoke callback when isConnected is true and connect event fires', () => {
            initializeConnectedObserver()
            const element = dom.createElement('div')
            element.isConnected = true
            const callback = createSpy('callback')

            onConnect(element, callback)
            expect(callback).toHaveBeenCalledTimes(1)

            dom.simulateConnect(dom.document, element)
            expect(callback).toHaveBeenCalledTimes(1)
        })
    })
})
