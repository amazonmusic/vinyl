/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { onConnect } from './extensions/connectedObserver'
import type { Writable } from './type'
import { applyStyles } from './extensions/applyStyles'
import {
    isObservableValue,
    type MaybeObservableValue,
    type ObservableValue,
} from '@amazon/vinyl-observable'
import { ActiveText } from './ActiveText'
import { applyVisibility } from './extensions/applyVisibility'
import { applyClassList } from './extensions/applyClassList'
import type { HookExtension } from './extensions/HookExtension'
import { passiveEventHandlers } from './extensions/applyPassiveHandler'
import type { AnyRecord } from '@amazon/vinyl-util'

/**
 * Names like `aria-label` / `role` / `data-*` / any hyphenated prop are DOM
 * attributes with no matching IDL property — assigning them via `element[k]`
 * creates an inert expando and the a11y tree / CSS attribute selectors never
 * see the value. Route those through setAttribute so JSX like
 * `<div aria-label="foo" />` actually reaches the DOM.
 */
function isAttributeOnlyName(k: string): boolean {
    return k === 'role' || k.indexOf('-') >= 0
}

/**
 * Sets a property on an element. Hyphenated / aria / role / data names are
 * assigned as HTML attributes; everything else stays on the property path so
 * camelCase IDL props (className, tabIndex, onClick, …) keep their existing
 * fast-path semantics.
 */
function setProp(element: HTMLElement, k: string, value: unknown): void {
    if (isAttributeOnlyName(k)) {
        if (value == null) element.removeAttribute(k)
        else element.setAttribute(k, String(value))
    } else {
        ;(element as any)[k] = value
    }
}

export type JsxFactory = (props: any, children: any[]) => any

/**
 * A map of custom jsx properties to be used in hook extensions.
 */
export const hookExtensions = {
    onConnect: onConnect<HTMLElement>,
    style: applyStyles,
    visible: applyVisibility,
    classList: applyClassList,
    ...passiveEventHandlers,
} as const satisfies Record<keyof any, HookExtension<any>>

export type AllowBindable<T> = {
    [K in keyof T]: MaybeObservableValue<T[K]>
}

/**
 * A type map of the jsx extended properties to the type provided to the hook.
 */
export type HookExtensions = {
    [p in keyof typeof hookExtensions]?: Parameters<
        (typeof hookExtensions)[p]
    >[1]
}

export type ElementProps<K extends keyof HTMLElementTagNameMap> = Omit<
    Partial<Writable<HTMLElementTagNameMap[K]>>,
    keyof HookExtensions
>

export type BindableElementProps<K extends keyof HTMLElementTagNameMap> =
    AllowBindable<ElementProps<K>>

/**
 * Allowed properties for intrinsic elements when writing jsx declarative markup.
 */
export type JsxElementProps<K extends keyof HTMLElementTagNameMap> =
    BindableElementProps<K> & HookExtensions

export type DomIntrinsicElements = {
    [K in keyof HTMLElementTagNameMap]: JsxElementProps<K>
}

export type JsxChild = Node | string | ObservableValue<Node | string>

export function jsx<K extends keyof HTMLElementTagNameMap>(
    type: K,
    props: JsxElementProps<K>,
    ...children: JsxChild[]
): HTMLElementTagNameMap[K]

export function jsx<Factory extends JsxFactory>(
    type: Factory,
    props: Parameters<Factory>[0],
    ...children: Parameters<Factory>[1]
): ReturnType<Factory>

export function jsx(type: any, props: any, ...children: any) {
    if (typeof type === 'string') {
        const element = document.createElement(type)
        for (const k in props) {
            const v = props[k]
            if (k in hookExtensions) {
                hookExtensions[k as keyof typeof hookExtensions](element, v)
                continue
            }
            if (isObservableValue(v)) {
                onConnect(element, () => {
                    return v.onData((data$) => setProp(element, k, data$))
                })
            } else {
                setProp(element, k, v)
            }
        }
        element.append(
            ...children
                .filter((child: JsxChild | null) => child != null)
                .map((child: JsxChild) => {
                    return isObservableValue(child) ? ActiveText(child) : child
                })
        )
        return element
    } else {
        return type(props, children)
    }
}

export function Fragment(_props: AnyRecord, children: (Node | string)[]) {
    return jsx(
        'div',
        {
            style: {
                display: 'contents',
            },
        },
        ...children
    )
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace JSX {
        type IntrinsicElements = DomIntrinsicElements
        type Element = HTMLElement
        type Fragment = HTMLElement
    }
}
