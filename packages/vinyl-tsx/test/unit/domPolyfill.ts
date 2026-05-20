/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    MockDocument,
    MockHTMLDivElement,
    MockText,
    implementEventFakes,
    polyfillCustomEvent,
} from '@amazon/vinyl-util/browserTestUtil'

type AnyNode = MockHTMLDivElement | MockText

const globalAny = globalThis as any

function implementDomTree(node: AnyNode) {
    const children: AnyNode[] = []

    function updateSiblings() {
        for (let i = 0; i < children.length; i++) {
            children[i].previousSibling = children[i - 1] ?? null
            children[i].nextSibling = children[i + 1] ?? null
        }
        node.firstChild = children[0] ?? null
        node.lastChild = children[children.length - 1] ?? null
    }

    function doInsertBefore(newNode: AnyNode, ref: AnyNode | null): AnyNode {
        const parentChildren = (newNode.parentNode as any)?._children as
            | AnyNode[]
            | undefined
        if (parentChildren) {
            const idx = parentChildren.indexOf(newNode)
            if (idx >= 0) parentChildren.splice(idx, 1)
            ;(newNode.parentNode as any)._updateSiblings?.()
        }

        if (ref == null) {
            children.push(newNode)
        } else {
            const idx = children.indexOf(ref)
            if (idx >= 0) children.splice(idx, 0, newNode)
            else children.push(newNode)
        }

        newNode.parentNode = node as any
        newNode.parentElement = node instanceof MockHTMLDivElement ? node : null
        updateSiblings()
        return newNode
    }

    node.appendChild.and.callFake(((child: any) =>
        doInsertBefore(child, null)) as any)
    node.insertBefore.and.callFake(((newNode: any, ref: any) =>
        doInsertBefore(newNode, ref)) as any)
    node.removeChild.and.callFake(((child: any) => {
        const idx = children.indexOf(child)
        if (idx >= 0) children.splice(idx, 1)
        child.parentNode = null
        child.parentElement = null
        updateSiblings()
        return child
    }) as any)
    ;(node as any)._children = children
    ;(node as any)._updateSiblings = updateSiblings
    node.childNodes = children as any
}

function createDiv(tagName: string): MockHTMLDivElement {
    const el = new MockHTMLDivElement()
    el.tagName = tagName.toUpperCase()

    const style: any = {
        display: '',
        setProperty(name: string, value: string | null) {
            if (name === 'display') this.display = value ?? ''
            this[name] = value
        },
        removeProperty(name: string) {
            if (name === 'display') this.display = ''
            else this[name] = null
            return ''
        },
    }
    el.style = style

    const tokens = new Set<string>()
    el.classList = {
        add: (...t: string[]) => t.forEach((tok) => tokens.add(tok)),
        remove: (...t: string[]) => t.forEach((tok) => tokens.delete(tok)),
        contains: (tok: string) => tokens.has(tok),
    } as any
    el.attributes = [] as any

    implementDomTree(el)
    implementEventFakes(el)

    el.append.and.callFake(((...nodes: any[]) => {
        for (const n of nodes) {
            if (typeof n === 'string') el.appendChild(createText(n))
            else el.appendChild(n)
        }
    }) as any)

    return el
}

function createText(content: string): MockText {
    const text = new MockText()
    text.textContent = content
    text.data = content
    implementDomTree(text)
    implementEventFakes(text)
    return text
}

class FakeMutationObserver implements MutationObserver {
    private callback: MutationCallback
    private target: Node | null = null
    static instances: FakeMutationObserver[] = []

    constructor(callback: MutationCallback) {
        this.callback = callback
        FakeMutationObserver.instances.push(this)
    }

    observe(target: Node) {
        this.target = target
    }
    disconnect() {
        this.target = null
    }
    takeRecords(): MutationRecord[] {
        return []
    }

    trigger(mutations: Array<{ addedNodes: Node[]; removedNodes: Node[] }>) {
        if (this.target) this.callback(mutations as any, this)
    }
}

export function installDomPolyfill() {
    const doc = new MockDocument()
    implementEventFakes(doc)
    doc.createElement.and.callFake(((tagName: string) =>
        createDiv(tagName)) as any)
    doc.createTextNode.and.callFake(((text: string) => createText(text)) as any)

    polyfillCustomEvent()

    beforeEach(() => {
        globalAny.document = doc
        globalAny.MutationObserver = FakeMutationObserver
        globalAny.getComputedStyle = (el: any) => ({
            display: el.style?.display || '',
        })
        FakeMutationObserver.instances = []
    })

    afterEach(() => {
        delete globalAny.document
        delete globalAny.MutationObserver
        delete globalAny.getComputedStyle
    })

    return {
        get document() {
            return doc
        },
        createElement: createDiv,
        createTextNode: createText,
        FakeMutationObserver,
        simulateConnect(parent: any, child: any) {
            parent.appendChild(child)
            child.isConnected = true
            FakeMutationObserver.instances[0]?.trigger([
                { addedNodes: [child], removedNodes: [] },
            ])
        },
        simulateDisconnect(parent: any, child: any) {
            parent.removeChild(child)
            child.isConnected = false
            FakeMutationObserver.instances[0]?.trigger([
                { addedNodes: [], removedNodes: [child] },
            ])
        },
    }
}
