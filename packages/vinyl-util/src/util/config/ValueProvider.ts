/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MaybePromise } from '@/util/type'

/**
 * A value of type T, a function returning T, or an async function returning a Promise<T>.
 * To be used with `resolveValueProvider`.
 */
export type ValueProvider<T> = T | (() => MaybePromise<T>)

/**
 * Resolves a ValueProvider to its underlying value.
 *
 * Handles all three ValueProvider forms: direct values, synchronous functions,
 * and async functions, returning a Promise that resolves to the value.
 *
 * @param valueProvider - The value, function, or async function to resolve
 * @returns A Promise resolving to the provided value of type T
 */
export function resolveValueProvider<T>(
    valueProvider: ValueProvider<T>
): Promise<T> {
    return Promise.resolve(
        typeof valueProvider === 'function'
            ? (valueProvider as () => MaybePromise<T>)()
            : valueProvider
    )
}
