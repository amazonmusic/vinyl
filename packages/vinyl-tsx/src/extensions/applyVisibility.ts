/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ObservableValue } from '@amazon/vinyl-observable'
import { onConnect } from './connectedObserver'

export function applyVisibility(
    element: HTMLElement,
    visible: boolean | ObservableValue<boolean>
): void {
    if (typeof visible === 'boolean') {
        if (!visible) element.style.display = 'none'
    } else {
        onConnect(element, () => {
            return visible.onData((value) => {
                if (value) element.style.removeProperty('display')
                else element.style.display = 'none'
            })
        })
    }
}
