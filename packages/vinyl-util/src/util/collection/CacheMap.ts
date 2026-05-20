/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A CacheMap is a Map that notifies when an entry is evicted.
 */
export interface CacheMap<K, V> extends Map<K, V> {
    /**
     * When an entry is added when at capacity, the least recently used entry will be removed.
     * This callback can be set to be notified with the element and key being evicted, which may be
     * used for disposal.
     */
    onEvict: ((element: V, key: K, list: CacheMap<K, V>) => void) | null
}
