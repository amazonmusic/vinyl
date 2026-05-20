/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    el,
    bindQuerySelector,
    hide,
    show,
    getVisible,
    setVisible,
    isHidden,
    isInputElement,
    setClassToken,
    walkDomDepthFirst,
} from '@amazon/vinyl-tsx'
import { installDomPolyfill } from './domPolyfill'

import createSpy = jasmine.createSpy

describe('domUtil', () => {
    const dom = installDomPolyfill()

    describe('el', () => {
        it('returns the element matching the selector', () => {
            const div = dom.createElement('div')
            dom.document.querySelector.and.callFake((sel: string) =>
                sel === 'div' ? div : null
            )
            expect(el('div')).toBe(div)
        })

        it('throws if no element matches', () => {
            dom.document.querySelector.and.returnValue(null)
            expect(() => el('missing')).toThrowError(
                'missing must be a DOM element'
            )
        })

        it('uses provided parentNode', () => {
            const parent = dom.createElement('div')
            const child = dom.createElement('span')
            parent.querySelector.and.callFake((sel: string) =>
                sel === 'span' ? child : null
            )
            expect(el('span', parent)).toBe(child)
        })
    })

    describe('bindQuerySelector', () => {
        it('returns a bound querySelector function', () => {
            const parent = dom.createElement('div')
            const child = dom.createElement('span')
            parent.querySelector.and.callFake((sel: string) =>
                sel === 'span' ? child : null
            )
            const query = bindQuerySelector(parent)
            expect(query('span')).toBe(child)
        })
    })

    describe('hide', () => {
        it('sets display to none', () => {
            const element = dom.createElement('div')
            hide(element)
            expect(element.style.display).toBe('none')
        })
    })

    describe('show', () => {
        it('removes display property', () => {
            const element = dom.createElement('div')
            element.style.display = 'none'
            show(element)
            expect(element.style.display).toBe('')
        })
    })

    describe('getVisible', () => {
        it('returns true when display is not none', () => {
            const element = dom.createElement('div')
            expect(getVisible(element)).toBeTrue()
        })

        it('returns false when display is none', () => {
            const element = dom.createElement('div')
            element.style.display = 'none'
            expect(getVisible(element)).toBeFalse()
        })
    })

    describe('setVisible', () => {
        it('hides when value is false', () => {
            const element = dom.createElement('div')
            setVisible(element, false)
            expect(element.style.display).toBe('none')
        })

        it('shows when value is true', () => {
            const element = dom.createElement('div')
            element.style.display = 'none'
            setVisible(element, true)
            expect(element.style.display).toBe('')
        })

        it('does nothing when already in desired state', () => {
            const element = dom.createElement('div')
            setVisible(element, true)
            expect(element.style.display).toBe('')
        })
    })

    describe('isHidden', () => {
        it('returns false for visible element', () => {
            const element = dom.createElement('div')
            element.parentElement = null
            ;(globalThis as any).getComputedStyle = () => ({
                display: 'block',
            })
            expect(isHidden(element)).toBeFalse()
        })

        it('returns true when element has display none', () => {
            const element = dom.createElement('div')
            element.parentElement = null
            ;(globalThis as any).getComputedStyle = () => ({
                display: 'none',
            })
            expect(isHidden(element)).toBeTrue()
        })

        it('returns true when parent has display none', () => {
            const parent = dom.createElement('div')
            const child = dom.createElement('span')
            child.parentElement = parent
            parent.parentElement = null
            ;(globalThis as any).getComputedStyle = (node: any) => ({
                display: node === parent ? 'none' : 'block',
            })
            expect(isHidden(child)).toBeTrue()
        })
    })

    describe('isInputElement', () => {
        it('returns true for input elements', () => {
            const input = dom.createElement('input')
            expect(isInputElement(input)).toBeTrue()
        })

        it('returns false for non-input elements', () => {
            const div = dom.createElement('div')
            expect(isInputElement(div)).toBeFalse()
        })

        it('returns false for null', () => {
            expect(isInputElement(null)).toBeFalse()
        })
    })

    describe('setClassToken', () => {
        it('adds class when toggled is true', () => {
            const element = dom.createElement('div')
            setClassToken(element, 'active', true)
            expect(element.classList.contains('active')).toBeTrue()
        })

        it('removes class when toggled is false', () => {
            const element = dom.createElement('div')
            element.classList.add('active')
            setClassToken(element, 'active', false)
            expect(element.classList.contains('active')).toBeFalse()
        })
    })

    describe('walkDomDepthFirst', () => {
        it('does nothing for null node', () => {
            const callback = createSpy('callback')
            walkDomDepthFirst(null, callback)
            expect(callback).not.toHaveBeenCalled()
        })

        it('does nothing for undefined node', () => {
            const callback = createSpy('callback')
            walkDomDepthFirst(undefined, callback)
            expect(callback).not.toHaveBeenCalled()
        })

        it('visits nodes depth-first', () => {
            const parent = dom.createElement('div')
            const child1 = dom.createElement('span')
            const child2 = dom.createElement('p')
            const grandchild = dom.createElement('a')
            parent.appendChild(child1)
            child1.appendChild(grandchild)
            parent.appendChild(child2)

            const visited: any[] = []
            walkDomDepthFirst(parent, (node) => visited.push(node))
            expect(visited).toEqual([grandchild, child1, child2, parent])
        })
    })
})
