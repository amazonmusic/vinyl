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

        it('clears nullable IDL props when observable emits null', () => {
            // onclick is typed as ((...) => any) | null in lib.dom, so null is
            // a valid runtime value. Regression guard: previously the null
            // branch coerced through '' and silently poisoned the handler slot
            // with a string so the event never fired.
            initializeConnectedObserver()
            const handler = () => {}
            const onclick = data<typeof handler | null>(handler)
            const el = jsx('div', { onclick }) as MockHTMLDivElement

            dom.simulateConnect(dom.document, el)
            expect(el.onclick).toBe(handler)
            onclick.value = null
            expect(el.onclick).toBeNull()
        })

        it('does not call removeAttribute when clearing IDL props', () => {
            // Reflection on the property clears the attribute; a redundant
            // removeAttribute would signal the old dual-clear path is back.
            initializeConnectedObserver()
            const onclick = data<(() => void) | null>(() => {})
            const el = jsx('div', { onclick }) as MockHTMLDivElement

            dom.simulateConnect(dom.document, el)
            el.removeAttribute.calls.reset()
            onclick.value = null
            expect(el.removeAttribute).not.toHaveBeenCalled()
        })

        // aria/role/data props are DOM attributes with no IDL property — writing
        // `el[k] = v` produces an inert expando. Verify setProp routes them via
        // setAttribute so the a11y tree / attribute selectors actually see them.
        it('routes aria-* props through setAttribute', () => {
            const el = jsx('div', {
                'aria-label': 'Play track',
            } as any) as MockHTMLDivElement
            expect(el.setAttribute).toHaveBeenCalledWith(
                'aria-label',
                'Play track'
            )
        })

        it('routes role through setAttribute', () => {
            const el = jsx('div', {
                role: 'button',
            } as any) as MockHTMLDivElement
            expect(el.setAttribute).toHaveBeenCalledWith('role', 'button')
        })

        it('routes data-* props through setAttribute', () => {
            const el = jsx('div', {
                'data-testid': 'card',
            } as any) as MockHTMLDivElement
            expect(el.setAttribute).toHaveBeenCalledWith('data-testid', 'card')
        })

        it('coerces non-string aria values to string attributes', () => {
            const el = jsx('div', {
                'aria-expanded': true,
            } as any) as MockHTMLDivElement
            expect(el.setAttribute).toHaveBeenCalledWith(
                'aria-expanded',
                'true'
            )
        })

        it('removes aria attribute when observable value becomes null', () => {
            initializeConnectedObserver()
            const label = data<string | null>('a')
            const el = jsx('div', {
                'aria-label': label,
            } as any) as MockHTMLDivElement

            dom.simulateConnect(dom.document, el)
            el.removeAttribute.calls.reset()
            label.value = null
            expect(el.removeAttribute).toHaveBeenCalledWith('aria-label')
        })

        it('keeps camelCase IDL properties on the property path', () => {
            // tabIndex is a real IDL property — regressing this to setAttribute
            // would break code that reads `el.tabIndex` synchronously.
            const el = jsx('div', { tabIndex: 3 }) as MockHTMLDivElement
            expect((el as any).tabIndex).toBe(3)
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
            ): HTMLElement => result

            expect(jsx(factory, {})).toBe(result)
        })

        it('defaults null props to an empty object', () => {
            const factory = createSpy<
                (
                    props: Record<string, unknown>,
                    children: unknown[]
                ) => HTMLElement
            >('factory').and.returnValue(dom.createElement('div'))
            jsx(factory, null as unknown as Record<string, unknown>)
            expect(factory).toHaveBeenCalledWith({}, [])
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
