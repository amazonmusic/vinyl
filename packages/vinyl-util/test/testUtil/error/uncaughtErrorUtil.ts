/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CodeRange } from '@amazon/vinyl-util'
import { parseStackLocation } from '@amazon/vinyl-util'
import type { MockEventTarget } from '@amazon/vinyl-util/browserTestUtil'
import {
    MockErrorEvent,
    MockPromiseRejectionEvent,
} from '@amazon/vinyl-util/browserTestUtil'

/**
 * Creates a code range object surrounding the given error.
 */
export function createRangeSurrounding(error: Error): CodeRange {
    const location = parseStackLocation(error.stack)
    if (!location) {
        pending('Cannot parse stacks in this environment.')
        return { start: null, end: null }
    }
    return {
        start: {
            source: location.source,
            file: location.file,
            row: location.row,
            col: (location.col ?? 0) - 1,
        },
        end: {
            source: location.source,
            file: location.file,
            row: location.row,
            col: (location.col ?? 0) + 1,
        },
    }
}

/**
 * Simulates an uncaught error event.
 */
export function throwMockError(target: MockEventTarget, error: any) {
    expect(target.removeEventListener).not.toHaveBeenCalled()
    const event = new MockErrorEvent()
    event.type = 'error'
    event.error = error
    target.dispatchEvent(event)
}

/**
 * Simulates an unhandled rejection to be caught by the global unhandled promise handler.
 */
export function rejectMockPromise(target: MockEventTarget, reason: any) {
    expect(target.removeEventListener).not.toHaveBeenCalled()
    // Not all environments can construct `PromiseRejectionEvent`
    const event = new MockPromiseRejectionEvent()
    event.type = 'unhandledrejection'
    event.reason = reason
    event.promise = Promise.reject(reason as Error).catch(() => void 0)
    target.dispatchEvent(event)
}
