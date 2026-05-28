/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { isDisposable } from '../core/disposable'
import { IllegalStateError } from '../error/IllegalStateError'
import { remove } from '../util/collection/array'
import type { Maybe } from '../util/type'

/**
 * Manages global initializers.
 */
export class GlobalRegistry {
    private registry: GlobalRef<any>[] = []

    /**
     * Returns the number of references currently in the registry.
     */
    get size(): number {
        return this.registry.length
    }

    /**
     * Registers an initializer that will be invoked during global state initialization.
     * @param initializer
     */
    register<T extends GlobalRef<any>>(initializer: T): T {
        this.registry.push(initializer)
        return initializer
    }

    /**
     * Removes a global ref from the registry.
     * May be called at any time.
     * @param ref
     * @return Returns true if the global ref was removed.
     */
    unregister(ref: GlobalRef<any>): boolean {
        return remove(this.registry, ref)
    }

    /**
     * Resets all registered initializers and sets this registry back to its pre-initialized state.
     * This is typically only done within unit tests, but may be called if all players are
     * disposed and the consumer intends to teardown global state.
     */
    reset() {
        for (const registryElement of this.registry) {
            registryElement.reset()
        }
    }
}

let _registry: GlobalRegistry | null = null

/**
 * Gets or creates the global registry instance.
 */
export function getGlobalRegistry(): GlobalRegistry {
    if (!_registry) _registry = new GlobalRegistry()
    return _registry
}

export interface GlobalRef<T> {
    /**
     * True if this has been initialized.
     */
    readonly initialized: boolean

    /**
     * Returns the factory-produced value.
     * Throws an {@link IllegalStateError} if the global registry has not been initialized.
     */
    readonly value: T

    /**
     * Overrides this initializer.
     * The previous initializer will be provided as an argument for extension.
     *
     * Throws an {@link IllegalStateError} if the global registry has been initialized.
     * @return Returns this
     */
    set(newInitializer: (previousInitializer: () => T) => T): GlobalRef<T>

    /**
     * Resets this initializer back to its pre-initialized state.
     * If the initializer produced a disposable value, it will be disposed.
     */
    reset(): void

    /**
     * Initializes the global ref.
     * This is done automatically on first use of `value`, but may be initialized eagerly.
     */
    initialize(): void
}

/**
 * When set, GlobalRefImpl records a stack trace each time it is initialized,
 * so a later "Cannot call when initialized" error can include the stack of
 * whoever last touched the ref. Used to diagnose async leakage between specs.
 *
 * Tests opt in via setGlobalRefDebug(true).
 */
let globalRefDebug = false

export function setGlobalRefDebug(enabled: boolean): void {
    globalRefDebug = enabled
}

export class GlobalRefImpl<T> implements GlobalRef<T> {
    private _value: T | undefined
    private _initialized = false
    private constructing = false
    private initializer: () => T
    private lastInitStack: Maybe<string> = null

    constructor(private readonly defaultInitializer: () => T) {
        this.initializer = defaultInitializer
    }

    get initialized(): boolean {
        return this._initialized
    }

    get value(): T {
        this.initialize()
        return this._value!
    }

    reset(): void {
        this.initializer = this.defaultInitializer
        if (!this._initialized) return
        this.assertNotConstructing()
        this._initialized = false
        this.lastInitStack = null
        if (isDisposable(this._value)) {
            this._value.dispose()
        }
        this._value = undefined
    }

    initialize(): void {
        if (this._initialized) return
        this.assertNotConstructing()
        this.constructing = true
        try {
            this._value = this.initializer()
        } catch (error) {
            this.constructing = false
            throw error
        }
        this.constructing = false
        this._initialized = true
        if (globalRefDebug) {
            this.lastInitStack = new Error('globalRef initialized').stack
        }
    }

    set(newInitializer: (previousInitializer: () => T) => T): GlobalRef<T> {
        this.assertNotInitialized()
        const overriddenInitializer = () => {
            return newInitializer(this.defaultInitializer)
        }
        this.initializer = overriddenInitializer
        return new GlobalRefOverride(
            this,
            overriddenInitializer,
            (newInitializer) => {
                this.initializer = newInitializer
            }
        )
    }

    private assertNotInitialized() {
        if (this._initialized) {
            const detail = this.lastInitStack
                ? `\nLast initialized at:\n${this.lastInitStack}`
                : ''
            throw new IllegalStateError(`Cannot call when initialized${detail}`)
        }
    }

    private assertNotConstructing() {
        if (this.constructing)
            throw new IllegalStateError('Cannot call during construction')
    }
}

class GlobalRefOverride<T> implements GlobalRef<T> {
    private initializer: () => T

    constructor(
        private readonly original: GlobalRef<T>,
        private readonly defaultInitializer: () => T,
        private readonly setInitializer: (value: () => T) => void
    ) {
        this.initializer = defaultInitializer
    }

    get initialized(): boolean {
        return this.original.initialized
    }

    get value(): T {
        return this.original.value
    }

    initialize(): void {
        this.setInitializer(this.initializer)
        this.original.initialize()
    }

    reset(): void {
        this.initializer = this.defaultInitializer
        this.original.reset()
        this.setInitializer(this.initializer)
    }

    set(newInitializer: (previousInitializer: () => T) => T): GlobalRef<T> {
        const overriddenInitializer = () => {
            return newInitializer(this.defaultInitializer)
        }
        this.initializer = overriddenInitializer
        this.setInitializer(overriddenInitializer)
        return new GlobalRefOverride(
            this,
            overriddenInitializer,
            this.setInitializer
        )
    }
}

/**
 * Creates a global reference that can be lazily initialized.
 * This function is tree-shakable as it doesn't perform any side effects on import.
 *
 * @param init Factory function that creates the value
 */
export function globalRef<T>(init: () => T): GlobalRef<T> {
    return getGlobalRegistry().register(new GlobalRefImpl(init))
}
