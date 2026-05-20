/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MockEvent } from '@/mock/dom/lib.dom'

class FakeCustomEvent<T = any> extends MockEvent implements CustomEvent<T> {
    readonly detail: T

    constructor(type: string, eventInitDict?: CustomEventInit<T>) {
        super()
        this.type = type
        this.detail = eventInitDict?.detail as T
        this.bubbles = eventInitDict?.bubbles ?? false
        this.cancelable = eventInitDict?.cancelable ?? false
    }

    initCustomEvent() {}
}

export function polyfillCustomEvent() {
    beforeEach(() => {
        if (typeof window === 'undefined')
            (global as any).CustomEvent = FakeCustomEvent
    })

    afterEach(() => {
        if (typeof window === 'undefined') delete (global as any).CustomEvent
    })
}
