/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An abstract persistence interface for an async key / value store.
 */
export interface KeyValuePersistence<T> {
    /**
     * Resolves to the value for the given key, or null if non-existent.
     * @param key
     */
    get(key: string): Promise<T | null>

    /**
     * Saves the given value to disk.
     *
     * @param key
     * @param value
     */
    set(key: string, value: T): Promise<void>

    /**
     * Removes the given key.
     *
     * @param key
     */
    remove(key: string): Promise<void>

    /**
     * Clears all items.
     */
    clear(): Promise<void>
}
