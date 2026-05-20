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
import type { AnyRecord, Maybe } from '@amazon/vinyl-util'

/**
 * Maps JS property names to their corresponding HTML attribute names where they differ.
 * Extensible — add entries for custom elements or non-standard properties.
 */
export const propToAttr: Record<string, string> = {
    acceptCharset: 'accept-charset',
    accessKey: 'accesskey',
    className: 'class',
    colSpan: 'colspan',
    contentEditable: 'contenteditable',
    crossOrigin: 'crossorigin',
    dateTime: 'datetime',
    dirName: 'dirname',
    encType: 'enctype',
    formAction: 'formaction',
    formEnctype: 'formenctype',
    formMethod: 'formmethod',
    formNoValidate: 'formnovalidate',
    formTarget: 'formtarget',
    htmlFor: 'for',
    httpEquiv: 'http-equiv',
    inputMode: 'inputmode',
    maxLength: 'maxlength',
    minLength: 'minlength',
    noModule: 'nomodule',
    noValidate: 'novalidate',
    readOnly: 'readonly',
    referrerPolicy: 'referrerpolicy',
    rowSpan: 'rowspan',
    tabIndex: 'tabindex',
    useMap: 'usemap',
}

/**
 * Sets a property on an element. When value is non-null, assigns directly via
 * property. When null, resets the property to '' and removes the HTML attribute
 * using the mapped name from {@link propToAttr}.
 */
function setProp(element: HTMLElement, k: string, value: unknown): void {
    if (value == null) {
        ;(element as any)[k] = ''
        const attr = propToAttr[k] ?? k
        element.removeAttribute(attr)
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
    [K in keyof T]: MaybeObservableValue<Maybe<T[K]>>
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
