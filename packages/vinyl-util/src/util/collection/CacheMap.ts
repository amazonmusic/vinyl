/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A map that notifies when an entry is evicted.
 *
 * Mirrors the ES2015 `Map<K, V>` interface (no iteration methods) so implementers
 * are not coupled to the evolving `MapIterator` shape in newer lib types.
 */
export interface CacheMap<K, V> {
    readonly size: number
    has(key: K): boolean
    get(key: K): V | undefined
    set(key: K, value: V): this
    delete(key: K): boolean
    clear(): void
    forEach(
        callbackfn: (value: V, key: K, map: CacheMap<K, V>) => void,
        thisArg?: any
    ): void

    /**
     * When an entry is added when at capacity, the least recently used entry will be removed.
     * This callback can be set to be notified with the element and key being evicted, which may be
     * used for disposal.
     */
    onEvict: ((element: V, key: K, list: CacheMap<K, V>) => void) | null
}
