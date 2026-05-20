/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { applyClassList, initializeConnectedObserver } from '@amazon/vinyl-tsx'
import { data } from '@amazon/vinyl-observable'
import { installDomPolyfill } from '../domPolyfill'

describe('applyClassList', () => {
    const dom = installDomPolyfill()

    it('adds static string classes immediately', () => {
        const el = dom.createElement('div')
        applyClassList(el, ['foo', 'bar'])
        expect(el.classList.contains('foo')).toBeTrue()
        expect(el.classList.contains('bar')).toBeTrue()
    })

    it('filters null values from static list', () => {
        const el = dom.createElement('div')
        applyClassList(el, ['foo', null, 'bar'])
        expect(el.classList.contains('foo')).toBeTrue()
        expect(el.classList.contains('bar')).toBeTrue()
    })

    it('subscribes to observable classes on connect', () => {
        initializeConnectedObserver()
        const el = dom.createElement('div')
        const className = data<string | null>('active')

        applyClassList(el, [className])
        expect(el.classList.contains('active')).toBeFalse()

        dom.simulateConnect(dom.document, el)
        expect(el.classList.contains('active')).toBeTrue()
    })

    it('reacts to observable class changes', () => {
        initializeConnectedObserver()
        const el = dom.createElement('div')
        const className = data<string | null>('active')

        applyClassList(el, [className])
        dom.simulateConnect(dom.document, el)
        expect(el.classList.contains('active')).toBeTrue()

        className.value = 'inactive'
        expect(el.classList.contains('active')).toBeFalse()
        expect(el.classList.contains('inactive')).toBeTrue()
    })

    it('removes class when observable becomes null', () => {
        initializeConnectedObserver()
        const el = dom.createElement('div')
        const className = data<string | null>('active')

        applyClassList(el, [className])
        dom.simulateConnect(dom.document, el)
        expect(el.classList.contains('active')).toBeTrue()

        className.value = null
        expect(el.classList.contains('active')).toBeFalse()
    })

    it('unsubscribes on disconnect and removes classes', () => {
        initializeConnectedObserver()
        const el = dom.createElement('div')
        const className = data<string | null>('active')

        applyClassList(el, [className])
        dom.simulateConnect(dom.document, el)
        expect(el.classList.contains('active')).toBeTrue()

        dom.simulateDisconnect(dom.document, el)
        expect(el.classList.contains('active')).toBeFalse()

        className.value = 'new-class'
        expect(el.classList.contains('new-class')).toBeFalse()
    })

    it('handles mixed static and observable classes', () => {
        initializeConnectedObserver()
        const el = dom.createElement('div')
        const dynamicClass = data<string | null>('dynamic')

        applyClassList(el, ['static', dynamicClass])
        expect(el.classList.contains('static')).toBeTrue()
        expect(el.classList.contains('dynamic')).toBeFalse()

        dom.simulateConnect(dom.document, el)
        expect(el.classList.contains('static')).toBeTrue()
        expect(el.classList.contains('dynamic')).toBeTrue()
    })

    it('does not remove a re-added class on cleanup after null transition', () => {
        initializeConnectedObserver()
        const el = dom.createElement('div')
        const className = data<string | null>('foo')

        applyClassList(el, [className])
        dom.simulateConnect(dom.document, el)
        expect(el.classList.contains('foo')).toBeTrue()

        className.value = null
        expect(el.classList.contains('foo')).toBeFalse()

        el.classList.add('foo')

        dom.simulateDisconnect(dom.document, el)
        expect(el.classList.contains('foo')).toBeTrue()
    })
})
