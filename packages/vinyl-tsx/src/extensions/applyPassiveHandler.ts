/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HookExtension } from './HookExtension'

export const passiveEventHandlers = {
    ontouchstart: applyPassiveHandler('ontouchstart'),
    ontouchmove: applyPassiveHandler('ontouchmove'),
    onwheel: applyPassiveHandler('onwheel'),
} as const

function applyPassiveHandler<K extends keyof GlobalEventHandlers>(
    key: K
): HookExtension<GlobalEventHandlers[K]> {
    const eventName = key.substring(2)
    return (element: HTMLElement, handler: GlobalEventHandlers[K]) => {
        element.addEventListener(eventName, handler as any, { passive: true })
    }
}
