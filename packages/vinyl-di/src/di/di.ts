/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type AnyRecord, IllegalStateError } from '@amazon/vinyl-util'
import {
    type AddDisposable,
    type Disposable,
    disposeAll,
    DisposedError,
    isDisposable,
    isPromiseLike,
    toDisposable,
    toDisposablePromise,
} from '@amazon/vinyl-util'
import { CyclicDependencyError } from './CyclicDependencyError'

/**
 * A factory function that produces a dependency.
 * Called at most once per container lifecycle.
 *
 * @param deps - A statically-typed record of other dependencies required by this factory,
 *               provided by other factories.
 * @param add  - A function used to register disposables or cleanup callbacks.
 *               Use this to add teardown logic that should run when the container is disposed.
 *
 * @returns The constructed dependency. If it:
 *   - Implements `Disposable`, it will automatically be disposed when the container is disposed.
 *     Do not manually pass it to `add`.
 *   - Is `PromiseLike`, the container will wait for the promise to resolve.
 *     If the resolved value implements `Disposable`, it will also be disposed automatically.
 *     Additionally, the promise will reject if the container is disposed before resolution.
 */
export type Factory<T> = (deps: any, add: AddDisposable) => T

/**
 * A symbol used to mark dependency factories as externally owned.
 *
 * If a `Factory` has this symbol as a property,
 * it will be considered to be owned by a parent container and will not be
 * disposed regardless of whether it implements {@link Disposable}.
 *
 * This prevents the dependency injection container from taking ownership
 * of dependencies that should be managed elsewhere.
 *
 * @example
 * ```typescript
 * const provider = () => someExternalService
 * provider[ExternalDependency] = true
 * ```
 */
export const ExternalDependency = Symbol('externalDependency')

/**
 * Creates a Factories record which provides the values of `deps`.
 * These dependencies will be considered to be owned externally and will not
 * be disposed by containers using these factories.
 *
 * This is useful when you want to inject existing instances into a dependency
 * container without transferring ownership. The container will use these
 * dependencies but won't dispose them when the container is disposed.
 *
 * @param deps - A record of dependency instances to be wrapped as factories.
 *               Each value will be returned as-is by the corresponding factory.
 * @returns An object with dependency factories for each member of deps.
 *          Each provider is marked with the {@link ExternalDependency} symbol.
 *
 * @example
 * ```typescript
 * const logger = new Logger()
 * const config = { port: 8080 }
 *
 * const factories = validateFactories({
 *     ...externalDependencies({ logger, config }),
 *     controller: (deps: { readonly logger: Logger }) => ({
 *         start: () => deps.logger.log('starting...'),
 *         dispose: () => deps.logger.log('disposed')
 *     })
 * })
 * const container = createContainer(factories)
 *
 * // logger and config won't be disposed when container is disposed
 * // controller will be disposed
 * container.dispose()
 * ```
 */
export function externalDependencies<T extends AnyRecord>(
    deps: T
): Factories<T> {
    const out = {} as any
    for (const key of Object.keys(deps)) {
        const provider = () => deps[key as keyof T]
        provider[ExternalDependency] = true
        out[key] = provider
    }
    return out
}

/**
 * A map from dependency keys to factory functions.
 *
 * For each property `K` in `T`, if `T[K]` is a `Dependency`, the value must be
 * a `Factory` that produces `T[K]`. If `T[K]` is not a `Dependency`, the
 * property type resolves to `never`, causing a compile-time error.
 *
 * This ensures factories are defined only for valid dependencies and that
 * each factory is correctly typed.
 *
 * @typeParam T - A record whose values are expected to be `Dependency` types.
 */
export type Factories<T = any> = {
    readonly [K in keyof T]: Factory<T[K]>
}

/**
 * Given a dependency map of keys to dependency factories, provides the mapped dependency
 * instances.
 */
export type Dependencies<T extends Factories> = {
    readonly [K in keyof T]: ReturnType<T[K]>
}

/**
 * A dependencies container provides final dependencies and a handle for disposal.
 */
export interface Container<T> extends Disposable {
    readonly dependencies: T
}

/**
 * Creates a {@link Container} from a dependency factory map.
 *
 * The dependencies will be a map of getters where the key matches the key within
 * `factories` and the value is a lazily constructed dependency obtained from
 * the respective provider.
 *
 * @param factories An object of key value pairs where the values are dependency
 * providers.
 */
export function createContainer<Dm extends Factories>(
    factories: Dm
): Container<Dependencies<Dm>> {
    let disposed = false
    const disposables: Disposable[] = []
    const o = {}
    let creationCount = 0
    Object.defineProperty(o, '__enumerableGuard', {
        get() {
            if (creationCount !== 0) {
                throw new IllegalStateError(
                    'Enumeration is not supported within factories.'
                )
            }
        },
        configurable: false,
        enumerable: true,
    })
    for (const key in factories) {
        if (key === '__enumerableGuard') continue
        let creating = false
        let created = false
        let value: any = null
        Object.defineProperty(o, key, {
            get(): any {
                if (disposed) throw new DisposedError()
                if (!created) {
                    if (creating)
                        throw new CyclicDependencyError(
                            `The dependency with key '${key}' is cyclical. Check to ensure dependencies are not used in a property iterator.`
                        )
                    creationCount++
                    creating = true
                    const provider = factories[key]
                    const index = disposables.length
                    const add: AddDisposable = (disposableOrUnsub) => {
                        if (disposableOrUnsub) {
                            const disposable = isDisposable(disposableOrUnsub)
                                ? disposableOrUnsub
                                : toDisposable(disposableOrUnsub)
                            disposables.splice(index, 0, disposable)
                        }
                        return disposableOrUnsub
                    }
                    value = provider(o, add)

                    if (isPromiseLike(value)) {
                        value = toDisposablePromise(value)
                    }
                    // Insert the disposable into the disposables list at the end of the list
                    // as it was before construction. This ensures reentrancy due to
                    // dependencies referenced during construction will be added after the
                    // independent.
                    if (
                        isDisposable(value) &&
                        !(ExternalDependency in provider)
                    )
                        disposables.splice(index, 0, value)
                    creating = false
                    created = true
                    creationCount--
                }
                return value
            },
            configurable: false,
            enumerable: true,
        })
    }
    return {
        dependencies: o as Dependencies<Dm>,
        dispose() {
            if (disposed) throw new DisposedError()
            disposeAll(disposables)
            disposed = true
            disposables.length = 0
        },
    }
}
