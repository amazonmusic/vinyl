/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CacheMap } from './CacheMap'
import { mapIter } from '../iteration/iterable'
import type { LinkedNode } from './LinkedList'
import { LinkedList } from './LinkedList'
import { IllegalStateError } from '../../error/IllegalStateError'

/**
 * An LRU Cache implementation.
 * An LRU (Least Recently Used) Cache is a Map with a fixed capacity. When the capacity is
 * exceeded, the least recently used element will be removed.
 * An element is considered to be used when it has been retrieved via `get`, or when it's been
 * `set`.
 * Iteration does not affect ordering.
 */
export class LruCache<K, V> implements CacheMap<K, V> {
    /**
     * A map of the list nodes.
     *
     * @private
     */
    private cache: Map<K, LinkedNode<[K, V]>> = new Map()

    /**
     * Most recently used elements are at the tail, least recently used are at the head.
     * @private
     */
    private list = new LinkedList<[K, V]>()

    /**
     * An element is about to be removed. Should return true if the element may be evicted,
     * otherwise false.
     * If false is returned for all elements, an IllegalStateError is thrown.
     */
    onEvicting: ((element: V, key: K, list: CacheMap<K, V>) => boolean) | null =
        null

    /**
     * When an element is added when at capacity, the least recently used element will be removed.
     * This callback can be set to be notified with the element being evicted, which may be used
     * for disposal.
     */
    onEvict: ((element: V, key: K, list: CacheMap<K, V>) => void) | null = null

    private _capacity = 0

    constructor(initialCapacity: number) {
        this._capacity = initialCapacity
    }

    get capacity(): number {
        return this._capacity
    }

    set capacity(value: number) {
        this._capacity = value
        while (this.cache.size > this.capacity) {
            this.evictLeastRecentlyUsed()
        }
    }

    /**
     * @returns the number of elements in the Map.
     */
    get size(): number {
        return this.cache.size
    }

    /**
     * @returns boolean indicating whether an element with the specified key exists or not.
     */
    has(key: K): boolean {
        return this.cache.has(key)
    }

    /**
     * Returns the mapped value for the given key, and moves the element to the most recently
     * used position.
     *
     * @returns Returns the element associated with the given key, or undefined if no such
     * element exists.
     */
    get(key: K): V | undefined {
        const node = this.cache.get(key)
        if (!node) return undefined
        this.list.pushNode(node)
        return node.value[1]
    }

    /**
     * Adds a new element with a specified key and value to the Map. If an element with the
     * same key already exists, the element will be updated and position moved to most recently
     * used.
     */
    set(key: K, value: V): this {
        if (this.has(key)) {
            const node = this.cache.get(key)!
            node.value[1] = value
            this.list.pushNode(node)
        } else {
            const node = this.list.push([key, value])
            this.cache.set(key, node)
            if (this.cache.size > this.capacity) {
                this.evictLeastRecentlyUsed()
            }
        }
        return this
    }

    private evictLeastRecentlyUsed() {
        let node = this.list.head
        while (node) {
            const [key, value] = node.value
            const allowed =
                this.onEvicting?.call(null, value, key, this) ?? true
            if (allowed) break
            node = node.next
        }
        if (!node)
            throw new IllegalStateError(
                'onEvicting returned false for all elements'
            )
        const [key, value] = node.value
        this.list.remove(node)
        this.cache.delete(node.value[0])
        this.onEvict?.call(null, value, key, this)
    }

    /**
     * Clears all elements from the cache.
     */
    clear(): void {
        this.list.clear()
        this.cache.clear()
    }

    /**
     * @returns true if an element in the Map existed and has been removed, or false if the element does not exist.
     */
    delete(key: K): boolean {
        if (!this.has(key)) return false
        const node = this.cache.get(key)!
        this.cache.delete(key)
        this.list.remove(node)
        return true
    }

    /**
     * Executes a provided function once per each key/value pair in the Map, in insertion order.
     *
     * @param callback A callback to invoke for every element in the cache.
     * @param thisArg Value to use as this when executing callback
     */
    forEach(
        callback: (value: V, key: K, map: this) => void,
        thisArg?: any
    ): void {
        return this.list.forEach((entry) => {
            callback.call(thisArg, entry[1], entry[0], this)
        })
    }

    /**
     * Returns an iterable of key, value pairs for every entry in the map.
     */
    entries(): IterableIterator<[K, V]> {
        return this[Symbol.iterator]()
    }

    /**
     * Returns an iterable of keys in the map. This will be ordered from least recently used to
     * most.
     */
    keys(): IterableIterator<K> {
        return mapIter(this.list, ([key]) => key)
    }

    /**
     * Returns an iterable of values in the map. This will be ordered from least recently used to
     * most.
     */
    values(): IterableIterator<V> {
        return mapIter(this.list, ([, value]) => value)
    }

    [Symbol.iterator](): IterableIterator<[K, V]> {
        return this.list[Symbol.iterator]()
    }

    get [Symbol.toStringTag](): string {
        return 'LruCache'
    }
}
