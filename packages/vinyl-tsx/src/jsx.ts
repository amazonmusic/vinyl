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
    [K in keyof HTMLElementTagNameMap]: JsxElementProps<K> & {
        children?: JsxChild
    }
}

/**
 * The children a factory component accepts in markup, derived from its
 * second parameter, optional or not. A component without a children parameter
 * accepts none.
 */
export type ComponentChildren<C> = C extends (
    props: any,
    children: infer Ch
) => any
    ? 0 extends 1 & Ch
        ? { children?: any }
        : unknown extends Ch
          ? { children?: never }
          : NonNullable<Ch> extends readonly (infer E)[]
            ? { children?: E | NonNullable<Ch> }
            : unknown
    : unknown

/**
 * A child of a JSX element. Arrays, including nested arrays, are flattened, so
 * a list of elements or text can be passed without spreading it. Null,
 * undefined, and false children are omitted, so conditional children such as
 * `{v && v.text}` can be written inline. `true` is not allowed.
 */
export type JsxChild =
    | Node
    | string
    | ObservableValue<Node | string>
    | null
    | undefined
    | false
    | readonly JsxChild[]

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
        element.append(...toNodes(children))
        return element
    } else {
        return type(props ?? {}, children)
    }
}

/**
 * Converts JSX children to the nodes or text to append, flattening arrays and
 * omitting null, undefined, and false children.
 */
function toNodes(children: readonly JsxChild[]): (Node | string)[] {
    const out: (Node | string)[] = []
    const add = (child: JsxChild) => {
        if (child == null || child === false) return
        if (Array.isArray(child)) {
            for (const c of child as readonly JsxChild[]) add(c)
        } else if (isObservableValue(child)) {
            out.push(ActiveText(child))
        } else {
            out.push(child as Node | string)
        }
    }
    for (const child of children) add(child)
    return out
}

export function Fragment(_props: AnyRecord, children: JsxChild[]) {
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
        type ElementChildrenAttribute = { children: unknown }
        type LibraryManagedAttributes<C, P> = P & ComponentChildren<C>
    }
}
