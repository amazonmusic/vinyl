/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActiveText, initializeConnectedObserver } from '@amazon/vinyl-tsx'
import { data } from '@amazon/vinyl-observable'
import { installDomPolyfill } from './domPolyfill'

describe('ActiveText', () => {
    const dom = installDomPolyfill()

    it('creates a text node with initial value', () => {
        initializeConnectedObserver()
        const d = data('hello')
        const text = ActiveText(d)
        expect(text.textContent).toBe('hello')
    })

    it('converts non-string values to string', () => {
        initializeConnectedObserver()
        const d = data(42)
        const text = ActiveText(d)
        expect(text.textContent).toBe('42')
    })

    it('updates text content when data changes after connection', () => {
        initializeConnectedObserver()
        const d = data('hello')
        const text = ActiveText(d)

        dom.simulateConnect(dom.document, text)
        d.value = 'world'
        expect(text.textContent).toBe('world')
    })

    it('sets textContent to empty string when value is null', () => {
        initializeConnectedObserver()
        const d = data<string | null>('hello')
        const text = ActiveText(d)

        dom.simulateConnect(dom.document, text)
        d.value = null
        expect(text.textContent).toBe('')
    })

    it('creates empty text node when initial value is null', () => {
        initializeConnectedObserver()
        const d = data<string | null>(null)
        const text = ActiveText(d)
        expect(text.textContent).toBe('')
    })

    it('does not update text content before connection', () => {
        initializeConnectedObserver()
        const d = data('hello')
        const text = ActiveText(d)

        d.value = 'world'
        expect(text.textContent).toBe('hello')
    })

    it('stops updating on disconnect', () => {
        initializeConnectedObserver()
        const d = data('hello')
        const text = ActiveText(d)

        dom.simulateConnect(dom.document, text)
        d.value = 'connected'
        expect(text.textContent).toBe('connected')

        dom.simulateDisconnect(dom.document, text)
        d.value = 'disconnected'
        expect(text.textContent).toBe('connected')
    })
})
