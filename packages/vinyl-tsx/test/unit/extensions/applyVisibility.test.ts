/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { applyVisibility, initializeConnectedObserver } from '@amazon/vinyl-tsx'
import { data } from '@amazon/vinyl-observable'
import { installDomPolyfill } from '../domPolyfill'

describe('applyVisibility', () => {
    const dom = installDomPolyfill()

    describe('static boolean', () => {
        it('sets display none when false', () => {
            const el = dom.createElement('div')
            applyVisibility(el, false)
            expect(el.style.display).toBe('none')
        })

        it('does not modify display when true', () => {
            const el = dom.createElement('div')
            applyVisibility(el, true)
            expect(el.style.display).toBe('')
        })
    })

    describe('observable boolean', () => {
        it('hides element when observable is false', () => {
            initializeConnectedObserver()
            const el = dom.createElement('div')
            const visible = data(false)

            applyVisibility(el, visible)
            dom.simulateConnect(dom.document, el)
            expect(el.style.display).toBe('none')
        })

        it('shows element when observable is true', () => {
            initializeConnectedObserver()
            const el = dom.createElement('div')
            const visible = data(true)

            applyVisibility(el, visible)
            dom.simulateConnect(dom.document, el)
            expect(el.style.display).toBe('')
        })

        it('reacts to changes', () => {
            initializeConnectedObserver()
            const el = dom.createElement('div')
            const visible = data(true)

            applyVisibility(el, visible)
            dom.simulateConnect(dom.document, el)
            expect(el.style.display).toBe('')

            visible.value = false
            expect(el.style.display).toBe('none')

            visible.value = true
            expect(el.style.display).toBe('')
        })

        it('unsubscribes on disconnect', () => {
            initializeConnectedObserver()
            const el = dom.createElement('div')
            const visible = data(true)

            applyVisibility(el, visible)
            dom.simulateConnect(dom.document, el)
            dom.simulateDisconnect(dom.document, el)

            visible.value = false
            expect(el.style.display).toBe('')
        })
    })
})
