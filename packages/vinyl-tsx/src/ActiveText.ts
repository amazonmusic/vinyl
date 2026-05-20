/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ObservableValue } from '@amazon/vinyl-observable'
import { onConnect } from './extensions/connectedObserver'

/**
 * A Text node bound to a data provider.
 * Created automatically when a child is a ObservableValue.
 * textContent will only be updated when the node is on the DOM.
 */
export function ActiveText<T>(data: ObservableValue<T>): Text {
    const text = document.createTextNode(String(data.value ?? ''))
    onConnect(text, () => {
        return data.onData((value) => {
            text.textContent = String(value ?? '')
        })
    })
    return text
}
