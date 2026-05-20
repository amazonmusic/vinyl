/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { applyStyles, initializeConnectedObserver } from '@amazon/vinyl-tsx'
import { data } from '@amazon/vinyl-observable'
import { installDomPolyfill } from '../domPolyfill'

describe('applyStyles', () => {
    const dom = installDomPolyfill()

    it('throws if style is a string', () => {
        const el = dom.createElement('div')
        expect(() => applyStyles(el, 'color: red' as any)).toThrowError(
            'expected style property to be type object'
        )
    })

    it('applies static style properties', () => {
        const el = dom.createElement('div')
        const spy = spyOn(el.style, 'setProperty')
        applyStyles(el, { fontSize: '12px' } as any)
        expect(spy).toHaveBeenCalledWith('font-size', '12px')
    })

    it('applies null value as null', () => {
        const el = dom.createElement('div')
        const spy = spyOn(el.style, 'setProperty')
        applyStyles(el, { fontSize: null } as any)
        expect(spy).toHaveBeenCalledWith('font-size', null)
    })

    it('applies undefined value as null', () => {
        const el = dom.createElement('div')
        const spy = spyOn(el.style, 'setProperty')
        applyStyles(el, { fontSize: undefined } as any)
        expect(spy).toHaveBeenCalledWith('font-size', null)
    })

    it('applies observable style property on connect', () => {
        initializeConnectedObserver()
        const el = dom.createElement('div')
        const spy = spyOn(el.style, 'setProperty')
        const fontSize = data('14px')

        applyStyles(el, { fontSize } as any)
        expect(spy).not.toHaveBeenCalled()

        dom.simulateConnect(dom.document, el)
        expect(spy).toHaveBeenCalledWith('font-size', '14px')
    })

    it('reacts to observable style changes', () => {
        initializeConnectedObserver()
        const el = dom.createElement('div')
        const spy = spyOn(el.style, 'setProperty')
        const fontSize = data('14px')

        applyStyles(el, { fontSize } as any)
        dom.simulateConnect(dom.document, el)
        spy.calls.reset()

        fontSize.value = '16px'
        expect(spy).toHaveBeenCalledWith('font-size', '16px')
    })

    it('sets null when observable value becomes null', () => {
        initializeConnectedObserver()
        const el = dom.createElement('div')
        const spy = spyOn(el.style, 'setProperty')
        const fontSize = data<string | null>('14px')

        applyStyles(el, { fontSize } as any)
        dom.simulateConnect(dom.document, el)
        spy.calls.reset()

        fontSize.value = null
        expect(spy).toHaveBeenCalledWith('font-size', null)
    })

    it('unsubscribes from observable on disconnect', () => {
        initializeConnectedObserver()
        const el = dom.createElement('div')
        const spy = spyOn(el.style, 'setProperty')
        const fontSize = data('14px')

        applyStyles(el, { fontSize } as any)
        dom.simulateConnect(dom.document, el)
        dom.simulateDisconnect(dom.document, el)
        spy.calls.reset()

        fontSize.value = '20px'
        expect(spy).not.toHaveBeenCalled()
    })

    describe('CSS custom properties', () => {
        it('applies a static custom property without kebab-casing', () => {
            const el = dom.createElement('div')
            const spy = spyOn(el.style, 'setProperty')
            applyStyles(el, { '--myColorVar': '#fff' })
            expect(spy).toHaveBeenCalledWith('--myColorVar', '#fff')
        })

        it('applies an observable custom property on connect', () => {
            initializeConnectedObserver()
            const el = dom.createElement('div')
            const spy = spyOn(el.style, 'setProperty')
            const volume = data('50%')

            applyStyles(el, { '--volume': volume })
            expect(spy).not.toHaveBeenCalled()

            dom.simulateConnect(dom.document, el)
            expect(spy).toHaveBeenCalledWith('--volume', '50%')
        })

        it('reacts to observable custom property changes', () => {
            initializeConnectedObserver()
            const el = dom.createElement('div')
            const spy = spyOn(el.style, 'setProperty')
            const volume = data('50%')

            applyStyles(el, { '--volume': volume })
            dom.simulateConnect(dom.document, el)
            spy.calls.reset()

            volume.value = '75%'
            expect(spy).toHaveBeenCalledWith('--volume', '75%')
        })

        it('sets null when observable custom property becomes null', () => {
            initializeConnectedObserver()
            const el = dom.createElement('div')
            const spy = spyOn(el.style, 'setProperty')
            const volume = data<string | null>('50%')

            applyStyles(el, { '--volume': volume })
            dom.simulateConnect(dom.document, el)
            spy.calls.reset()

            volume.value = null
            expect(spy).toHaveBeenCalledWith('--volume', null)
        })

        it('mixes typed style fields and custom properties', () => {
            const el = dom.createElement('div')
            const spy = spyOn(el.style, 'setProperty')
            applyStyles(el, {
                fontSize: '12px',
                '--gap': '8px',
            })
            expect(spy).toHaveBeenCalledWith('font-size', '12px')
            expect(spy).toHaveBeenCalledWith('--gap', '8px')
        })
    })
})
