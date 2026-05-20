/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    jsx,
    Fragment,
    hookExtensions,
    initializeConnectedObserver,
} from '@amazon/vinyl-tsx'
import { data } from '@amazon/vinyl-observable'
import { installDomPolyfill } from './domPolyfill'
import type { MockHTMLDivElement } from '@amazon/vinyl-util/browserTestUtil'

import createSpy = jasmine.createSpy

describe('jsx', () => {
    const dom = installDomPolyfill()

    describe('intrinsic elements', () => {
        it('creates an element with the given tag name', () => {
            const el = jsx('div', {})
            expect(el.tagName).toBe('DIV')
        })

        it('sets static properties', () => {
            const el = jsx('div', { id: 'test' })
            expect(el.id).toBe('test')
        })

        it('appends string children', () => {
            const el = jsx('div', {}, 'hello')
            expect(el.childNodes.length).toBe(1)
        })

        it('appends node children', () => {
            const child = dom.createElement('span')
            const el = jsx('div', {}, child)
            expect(el.childNodes[0]).toBe(child)
        })

        it('filters null children', () => {
            const el = jsx('div', {}, null as unknown as string, 'hello')
            expect(el.childNodes.length).toBe(1)
        })

        it('converts observable children to ActiveText', () => {
            initializeConnectedObserver()
            const d = data('reactive')
            const el = jsx('div', {}, d)
            expect(el.childNodes.length).toBe(1)
            expect(el.childNodes[0].textContent).toBe('reactive')
        })

        it('binds observable properties on connect', () => {
            initializeConnectedObserver()
            const title = data('initial')
            const el = jsx('div', { title })

            dom.simulateConnect(dom.document, el)
            expect(el.title).toBe('initial')

            title.value = 'updated'
            expect(el.title).toBe('updated')
        })

        it('removes attribute when observable value becomes null', () => {
            initializeConnectedObserver()
            const title = data<string | null>('initial')
            const el = jsx('div', { title }) as MockHTMLDivElement

            dom.simulateConnect(dom.document, el)
            el.removeAttribute.calls.reset()
            title.value = null
            expect(el.title).toBe('')
            expect(el.removeAttribute).toHaveBeenCalledWith('title')
        })

        it('maps className to class attribute when removing', () => {
            initializeConnectedObserver()
            const className = data<string | null>('active')
            const el = jsx('div', { className }) as MockHTMLDivElement

            dom.simulateConnect(dom.document, el)
            el.removeAttribute.calls.reset()
            className.value = null
            expect(el.removeAttribute).toHaveBeenCalledWith('class')
        })

        it('delegates hook extension properties', () => {
            const el = jsx('div', { visible: false })
            expect(el.style.display).toBe('none')
        })

        it('delegates style hook extension', () => {
            const el = jsx('div', { style: { fontSize: '12px' } })
            expect(
                (el.style as unknown as Record<string, string>)['font-size']
            ).toBe('12px')
        })
    })

    describe('factory components', () => {
        it('calls factory function with props and children', () => {
            const factory = createSpy<
                (props: { foo: string }, children: string[]) => HTMLElement
            >('factory').and.returnValue(dom.createElement('div'))
            jsx(factory, { foo: 'bar' }, 'child1', 'child2')
            expect(factory).toHaveBeenCalledWith({ foo: 'bar' }, [
                'child1',
                'child2',
            ])
        })

        it('returns the factory result', () => {
            const result = dom.createElement('div')
            const factory = (
                _props: Record<string, unknown>,
                _children: unknown[]
            ): HTMLElement => result as unknown as HTMLElement

            expect(jsx(factory, {})).toBe(result as unknown as HTMLElement)
        })
    })

    describe('Fragment', () => {
        it('creates a div with display contents', () => {
            const el = Fragment({}, ['hello'])
            expect(el.tagName).toBe('DIV')
        })

        it('appends children', () => {
            const el = Fragment({}, ['hello', 'world'])
            expect(el.childNodes.length).toBe(2)
        })
    })

    describe('hookExtensions', () => {
        it('includes expected extensions', () => {
            expect(hookExtensions.onConnect).toBeDefined()
            expect(hookExtensions.style).toBeDefined()
            expect(hookExtensions.visible).toBeDefined()
            expect(hookExtensions.classList).toBeDefined()
            expect(hookExtensions.ontouchstart).toBeDefined()
            expect(hookExtensions.ontouchmove).toBeDefined()
            expect(hookExtensions.onwheel).toBeDefined()
        })
    })
})
