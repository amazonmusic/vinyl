/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MockEvent } from '@/mock/dom/lib.dom'
import { asSpy } from '@/mock/asSpy'

type Callback = (event: Event) => any
interface CallbackOptions {
    once: boolean
}

export interface EventFakesHandle {
    /**
     * Returns true if there are any remaining listeners on this event target.
     */
    hasAnyListeners(): boolean
}

/**
 * Implements addEventListener, dispatchEvent, and removeEventListener.
 * Simulates browser behavior for dispatching events.
 *
 * Does not differentiate between passive and active listeners or work with a dom hierarchy
 * for bubble/capture phases.
 *
 * `dispatchEvent` must use subtypes of MockEvent.
 */
export function implementEventFakes(target: EventTarget): EventFakesHandle {
    // type -> capture -> options
    const callbacks = new Map<
        string,
        Map<boolean, Map<Callback, CallbackOptions>>
    >()

    asSpy(target, 'addEventListener').and.callFake(
        (
            type: string,
            callback: Callback,
            addOptions?: AddEventListenerOptions | boolean
        ) => {
            if (!callbacks.has(type)) callbacks.set(type, new Map())
            const captureMap = callbacks.get(type)!
            let newOptions: CallbackOptions
            let capture: boolean
            if (addOptions == null) {
                newOptions = { once: false }
                capture = false
            } else if (typeof addOptions === 'boolean') {
                newOptions = { once: false }
                capture = addOptions
            } else {
                newOptions = { once: addOptions.once ?? false }
                capture = addOptions.capture ?? false
            }

            if (!captureMap.has(capture)) captureMap.set(capture, new Map())
            const callbacksMap = captureMap.get(capture)!
            if (!callbacksMap.has(callback)) {
                // A repeat call to addEventListener with the same type and callback but with
                // a different `once` value will not overwrite the previous once. This is normal
                // browser behavior.
                callbacksMap.set(callback, newOptions)
            }
        }
    )

    asSpy(target, 'removeEventListener').and.callFake(
        (
            type: string,
            callback: Callback,
            options?: EventListenerOptions | boolean
        ) => {
            if (!callbacks.has(type)) return
            const captureMap = callbacks.get(type)!
            const capture =
                typeof options === 'boolean'
                    ? options
                    : (options?.capture ?? false)
            if (!captureMap.has(capture)) return
            const callbacksMap = captureMap.get(capture)!
            callbacksMap.delete(callback)
        }
    )

    asSpy(target, 'dispatchEvent').and.callFake((event: MockEvent): boolean => {
        // Note, does not support a display hierarchy and bubble/capture phases. Simulates only
        // at target such as an EventTarget object would support.
        if (!callbacks.has(event.type)) return true
        const captureMap = callbacks.get(event.type)!
        event.eventPhase = event.AT_TARGET
        event.currentTarget = target
        event.target = target

        if (captureMap.has(true)) {
            const captureCallbacks = captureMap.get(true)!
            for (const [callback, options] of captureCallbacks.entries()) {
                if (event.stopImmediatePropagation.calls.any()) break
                if (
                    event.eventPhase === event.AT_TARGET ||
                    event.eventPhase === event.CAPTURING_PHASE
                ) {
                    if (options.once) {
                        target.removeEventListener(event.type, callback, true)
                    }
                    callback(event)
                }
            }
        }
        if (captureMap.has(false)) {
            const bubbleCallbacks = captureMap.get(false)!
            for (const [callback, options] of bubbleCallbacks.entries()) {
                if (event.stopImmediatePropagation.calls.any()) break
                if (
                    event.eventPhase === event.AT_TARGET ||
                    event.eventPhase === event.BUBBLING_PHASE
                ) {
                    if (options.once) {
                        target.removeEventListener(event.type, callback, false)
                    }
                    callback(event)
                }
            }
        }
        return !event.cancelable || !event.preventDefault.calls.any()
    })

    return {
        hasAnyListeners(): boolean {
            for (const typeMap of callbacks.values()) {
                for (const captureMap of typeMap.values()) {
                    if (captureMap.size > 0) return true
                }
            }
            return false
        },
    }
}
