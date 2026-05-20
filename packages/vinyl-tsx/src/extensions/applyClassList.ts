/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    isObservableValue,
    type ObservableValue,
} from '@amazon/vinyl-observable'
import { onConnect } from './connectedObserver'
import type { Maybe, Unsubscribe } from '@amazon/vinyl-util'

export function applyClassList(
    element: HTMLElement,
    classList: readonly (Maybe<string> | ObservableValue<Maybe<string>>)[]
): void {
    const tokens = classList.filter((s) => typeof s === 'string')
    element.classList.add(...tokens)
    if (tokens.length < classList.length) {
        onConnect(element, () => {
            const subs: Unsubscribe[] = []
            for (const dP of classList.filter(isObservableValue)) {
                subs.push(bindClass(element, dP))
            }
            return () => {
                subs.forEach((sub) => sub())
            }
        })
    }
}

function bindClass(
    element: HTMLElement,
    tokenProvider: ObservableValue<Maybe<string>>
): Unsubscribe {
    let current: string | null = null
    const dataSub = tokenProvider.onData((className) => {
        if (current) element.classList.remove(current)
        if (className) {
            current = className
            element.classList.add(className)
        } else {
            current = null
        }
    })
    return () => {
        if (current != null) element.classList.remove(current)
        dataSub()
    }
}
