/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    isObservableValue,
    type ObservableValue,
} from '@amazon/vinyl-observable'
import { onConnect } from './connectedObserver'
import {
    createDisposer,
    noop,
    type Maybe,
    type Unsubscribe,
} from '@amazon/vinyl-util'

export function applyClassList(
    element: HTMLElement,
    classList: readonly (Maybe<string> | ObservableValue<Maybe<string>>)[]
): Unsubscribe {
    const tokens = classList.filter((s) => typeof s === 'string')
    element.classList.add(...tokens)
    if (tokens.length < classList.length) {
        return onConnect(element, () => {
            const { add, dispose } = createDisposer()
            for (const dP of classList.filter(isObservableValue)) {
                add(bindClass(element, dP))
            }
            return dispose
        })
    }
    return noop
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
