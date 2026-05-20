/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export function el<K extends keyof HTMLElementTagNameMap>(
    selectors: K,
    parentNode?: ParentNode
): HTMLElementTagNameMap[K]
export function el(selectors: string, parentNode?: ParentNode): HTMLElement
export function el<E extends Element = Element>(
    selectors: string,
    parentNode: ParentNode = document
): E {
    const element = parentNode.querySelector(selectors)
    if (!element) throw new Error(`${selectors} must be a DOM element`)
    return element as E
}

export interface QuerySelector {
    <K extends keyof HTMLElementTagNameMap>(
        selectors: K,
        parentNode?: ParentNode
    ): HTMLElementTagNameMap[K]
    (selectors: string): HTMLElement
}

export function bindQuerySelector(parentNode: ParentNode): QuerySelector {
    return (selectors: string) => el(selectors, parentNode)
}

export function hide(element: HTMLElement) {
    element.style.display = 'none'
}

export function show(element: HTMLElement) {
    element.style.removeProperty('display')
}

export function getVisible(element: HTMLElement): boolean {
    return element.style.display !== 'none'
}

export function setVisible(element: HTMLElement, value: boolean) {
    if (getVisible(element) === value) return
    if (value) show(element)
    else hide(element)
}

export function isHidden(element: HTMLElement) {
    let node: HTMLElement | null = element
    while (node) {
        if (getComputedStyle(node).display === 'none') return true
        node = node.parentElement
    }
    return false
}

export function isInputElement(
    value: Element | null
): value is HTMLInputElement {
    return value?.tagName.toLowerCase() === 'input'
}

/**
 * Adds or removes a class token to an element.
 *
 * @param value The element whose classList to modify.
 * @param token The class token.
 * @param toggled If true, the token is added, if false, removed.
 */
export function setClassToken(
    value: HTMLElement,
    token: string,
    toggled: boolean
) {
    if (toggled) {
        value.classList.add(token)
    } else {
        value.classList.remove(token)
    }
}

export type ElementInitOptions = {
    readonly parent?: HTMLElement
    readonly className?: string
}

/**
 * Recursively walks a node hierarchy, invoking a callback for every node, depth first.
 *
 * @param node
 * @param callback
 */
export function walkDomDepthFirst(
    node: Node | undefined | null,
    callback: (node: Node) => void
) {
    if (!node) return
    let next = node.firstChild
    while (next) {
        walkDomDepthFirst(next, callback)
        next = next.nextSibling
    }
    callback(node)
}
