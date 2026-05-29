/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The minimal `Map`-shaped interface that {@link getOrSet} needs.
 */
interface GetOrSetMap<K, V> {
    has(key: K): boolean
    get(key: K): V | undefined
    set(key: K, value: V): unknown
}

/**
 * Gets the value on map for the given key if it exists, otherwise sets [key] to `defaultValue`,
 * returning the newly set value.
 *
 * @param map
 * @param key
 * @param defaultValue
 */
export function getOrSet<K, V>(
    map: GetOrSetMap<K, V>,
    key: K,
    defaultValue: (key: K) => V
): V {
    if (map.has(key)) {
        return map.get(key) as V
    } else {
        const value = defaultValue(key)
        map.set(key, value)
        return value
    }
}

/**
 * Flips a map so that the keys become the values and the values become the keys.
 *
 * @param map
 * @return Returns a new map.
 */
export function flipMap<K, V>(map: Iterable<readonly [K, V]>): Map<V, K> {
    const result = new Map<V, K>()
    for (const [key, value] of map) {
        result.set(value, key)
    }
    return result
}
