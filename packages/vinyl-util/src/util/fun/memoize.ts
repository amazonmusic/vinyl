/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { LruCache } from '@/util/collection/LruCache'
import { getOrSet } from '@/util/map/map'
import type { Fun } from '@/util/type'

export interface MemoizedFunction {
    clear(): void
}

/**
 * Returns a wrapper function where when called, retains the return value of `inner`, returning that
 * value on consecutive calls without invoking `inner` again.
 *
 * @param inner The function to memoize results.
 * @return Returns a memoized function with a `clear` method to reset the cached value.
 */
export function memoize<T extends () => any>(inner: T): MemoizedFunction & T

/**
 * Returns a wrapper function where when called, retains the return value of `inner`, returning that
 * value on consecutive calls without invoking `inner` again.
 *
 * @param inner The function to memoize results.
 * @param keyProvider When more than one parameter is expected, a keyProvider is required, which
 * returns a unique key given the arguments provided to the memoized function.
 * @param capacity
 * @return Returns a memoized function with a `clear` method to reset the cache.
 */
export function memoize<T extends Fun>(
    inner: T,
    keyProvider: (...args: Parameters<T>) => any,
    capacity?: number
): MemoizedFunction & T

export function memoize<T extends Fun>(
    inner: T,
    keyProvider?: (...args: Parameters<T>) => any,
    capacity = 500
): MemoizedFunction & T {
    if (!keyProvider) {
        let cached = false
        let value: ReturnType<T> | undefined = undefined
        const memoized = (): ReturnType<T> => {
            if (!cached) {
                cached = true
                value = inner()
            }
            return value as ReturnType<T>
        }
        return Object.assign(
            memoized as T,
            {
                clear: () => {
                    cached = false
                    value = undefined
                },
            } as const
        )
    } else if (capacity === 0) {
        const memoized = (...args: Parameters<T>): ReturnType<T> =>
            inner(...args)
        return Object.assign(
            memoized as T,
            {
                clear: () => {},
            } as const
        )
    } else if (capacity === 1) {
        let hasValue = false
        let cachedKey: any
        let cachedValue: ReturnType<T>
        const memoized = (...args: Parameters<T>): ReturnType<T> => {
            const key = keyProvider(...args)
            if (!hasValue || cachedKey !== key) {
                hasValue = true
                cachedKey = key
                cachedValue = inner(...args)
            }
            return cachedValue
        }
        return Object.assign(
            memoized as T,
            {
                clear: () => {
                    hasValue = false
                },
            } as const
        )
    } else {
        const cache = new LruCache<any, ReturnType<T>>(capacity)
        const memoized = (...args: Parameters<T>): ReturnType<T> => {
            const key = keyProvider(...args)
            return getOrSet(cache, key, () => inner(...args))
        }
        return Object.assign(
            memoized as T,
            {
                clear: () => {
                    cache.clear()
                },
            } as const
        )
    }
}
