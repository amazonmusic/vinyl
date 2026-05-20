/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogTarget } from '@/logging/LogTarget'
import { logError, logVerbose } from '@/logging/Logger'
import type { KeyValuePersistence } from '@/persistence/KeyValuePersistence'
import { persistenceRef } from '@/persistence/persistenceRef'
import type { Maybe } from '@/util/type'
import { lazy, type Lazy } from '@/util/object/lazy'

/**
 * Configuration for PersistentItemImpl
 * These values will not be accessed until the persistent item is first used.
 */
export interface PersistentItemOptions<T, FormatType> {
    /**
     * The key to use in the Persistence layer.
     */
    readonly key: string

    /**
     * The default to use when the key is not present or deserialization fails.
     */
    readonly defaultValue: T

    /**
     * If provided, will be invoked on the persisted value.
     */
    readonly validator?: Maybe<(input: unknown) => asserts input is T>

    /**
     * The key/value persistence raw data provider.
     *
     * Provides the KeyValuePersistence controller.
     * Can be a method to lazily provide the controller, will be invoked once on first access.
     */
    readonly persistence:
        | KeyValuePersistence<FormatType>
        | (() => KeyValuePersistence<FormatType>)

    /**
     * Serializes the value for persistence.
     */
    readonly serialize: (value: T) => FormatType

    /**
     * Deserializes value into the output value.
     */
    readonly deserialize: (value: FormatType) => T
}

export interface PersistentItem<T> {
    /**
     * Gets this item from persistence.
     */
    get(): Promise<T>

    /**
     * Saves this item to persistence.
     */
    set(value: T): Promise<void>

    /**
     * Removes this item from persistence.
     */
    remove(): Promise<void>
}

export class PersistentItemImpl<T, FormatType>
    implements PersistentItem<T>, LogTarget
{
    readonly logPrefix: string
    private readonly persistence: Lazy<KeyValuePersistence<FormatType>>

    constructor(
        private readonly options: PersistentItemOptions<T, FormatType>
    ) {
        this.logPrefix = `PersistentItem_${options.key}`
        this.persistence = lazy(() => {
            return typeof options.persistence === 'function'
                ? options.persistence()
                : options.persistence
        })
    }

    /**
     * Gets this item from persistence.
     */
    async get(): Promise<T> {
        const { key, defaultValue, deserialize, validator } = this.options
        const persistence = this.persistence.value
        const rawStr = await persistence.get(key)
        if (rawStr == null) return defaultValue
        try {
            const value = deserialize(rawStr)
            validator?.(value)
            return value
        } catch (error) {
            logError(this, `could not revive <${key}> from persistence`, error)
            await persistence.remove(key)
            return defaultValue
        }
    }

    /**
     * Saves this item to persistence.
     */
    set(value: T): Promise<void> {
        const { key, serialize } = this.options
        logVerbose(this, 'set', value)
        const persistence = this.persistence.value
        return persistence.set(key, serialize(value))
    }

    /**
     * Removes this item from persistence.
     */
    remove(): Promise<void> {
        const { key } = this.options
        logVerbose(this, 'remove')
        const persistence = this.persistence.value
        return persistence.remove(key)
    }
}

const persistentItemStringOptionDefaults = {
    serialize: JSON.stringify,
    deserialize: JSON.parse,
    persistence: () => persistenceRef.value,
} as const satisfies Partial<PersistentItemOptions<any, string>>

/**
 * An alias for persistent item options with reasonable defaults for string
 * serialization.
 * This will use JSON stringify/parse and the global KeyValuePersistence object
 * from `persistenceRef`.
 */
export type DefaultStringPersistentItemOptions<T> = Omit<
    PersistentItemOptions<T, string>,
    'persistence' | 'deserialize' | 'serialize'
> &
    Partial<
        Pick<
            PersistentItemOptions<T, string>,
            'persistence' | 'deserialize' | 'serialize'
        >
    >

/**
 * Creates a new PersistenceItem from the given options.
 * If serializer, deserializer, and persistence is omitted, then
 * JSON stringify/parse and the global KeyValuePersistence object
 * from `persistenceRef` will be used.
 *
 * @param options
 */
export function createPersistentItem<T>(
    options: DefaultStringPersistentItemOptions<T>
): PersistentItemImpl<T, string>
export function createPersistentItem<T, U>(
    options: PersistentItemOptions<T, U>
): PersistentItemImpl<T, U>
export function createPersistentItem<T>(
    options: DefaultStringPersistentItemOptions<any>
): PersistentItemImpl<T, any> {
    return new PersistentItemImpl<T, any>({
        ...persistentItemStringOptionDefaults,
        ...options,
    })
}
