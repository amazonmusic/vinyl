/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * Provides validation utilities for type-safe dependency factories.
 */

import type { Factories, Factory } from './di'
import type { AddDisposable, IsNever, Merge } from '@amazon/vinyl-util'

/**
 * A compile-time validation error that a dependency may not cycle back upon itself.
 */
export type NeverCyclicDependency<
    T extends PropertyKey,
    U extends PropertyKey[],
> = [never, T, 'cyclic dependency', U]

/**
 * A compile-time validation error that a provided dependency must be assignable
 * to factories for which it is an input.
 */
export type NeverWrongReturnType<Expected, Actual> = [
    never,
    'expected provided dependency is not a subtype of what is used. Expected subtype of:',
    Expected,
    'Actual: ',
    Actual,
]

/**
 * A compile-time validation error that a dependency must be a supertype of the actual type
 * provided.
 */
export type NeverWrongDependencyType<Expected, Actual> = [
    never,
    'expected dependency is not a supertype of what is provided. Expected supertype of:',
    Expected,
    'Actual: ',
    Actual,
]

/**
 * A factory expects a dependency that isn't defined.
 */
export type NeverMissingDependency<K> = [
    never,
    'provider is missing a dependency for key:',
    K,
]

/**
 * A factory expects a non-void return type.
 */
export type NeverNoVoidReturnType = [never, 'void return type not allowed']

/**
 * A factory must be a function.
 */
export type NeverInvalidFactoryType = [never, 'not a valid factory']

/**
 * Dependencies must be an object.
 */
export type NeverInvalidDependenciesType = [never, 'not valid dependency type']

/**
 * A compile-time validation error that dependency factories take an input of type object.
 */
export type NeverWrongDependenciesInput = [
    never,
    'expected dependency factory to have an object argument',
]

/**
 * Provides a compile-time assertion that the given dependency map provides valid factories.
 */
export function validateFactories<Dm extends Factories>(
    dependencyMap: ValidFactories<Dm>
): NoInfer<Dm> {
    return dependencyMap as Dm
}

/**
 * Validates that the type provided is a valid dependency map.
 *
 * This will guarantee that:
 * - All dependency factories exist with the correct signature.
 * - There are no cyclic dependencies.
 * - The factory's dependencies are provided.
 *
 * @see ValidFactory
 */
export type ValidFactories<Dm> = {
    readonly [K in keyof Dm]: ValidFactory<Dm, K>
}

/**
 * Validates that the dependency factory is valid.
 */
export type ValidFactory<Dm, K extends keyof Dm> = Dm[K] extends (
    deps: infer Deps,
    add: AddDisposable
) => infer R
    ? [R] extends [void]
        ? [never, Dm[K]]
        : [R] extends [ExpectedInputType<Dm, K>]
          ? Dm[K] extends () => any
              ? Dm[K] // No dependencies
              : Deps extends ValidProviderDependencies<Deps, Dm>
                ? Dm[K]
                : (deps: ValidProviderDependencies<Deps, Dm>) => R
          : NeverWrongReturnType<ExpectedInputType<Dm, K>, R>
    : NeverInvalidFactoryType

type _ExpectedInputUnion<Dm, K extends keyof Dm> = Dm[keyof Dm] extends (
    deps: infer Deps,
    add: AddDisposable
) => any
    ? K extends keyof Deps
        ? Deps[K]
        : never
    : never

export type ExpectedInputType<Dm, K extends keyof Dm> =
    // If the union provides `never`, it isn't a required dependency for any other factory, allow `any`
    IsNever<_ExpectedInputUnion<Dm, K>> extends true
        ? any
        : _ExpectedInputUnion<Dm, K>

/**
 * A type validating dependency overrides when merged with existing dependency factories.
 */
export type ValidFactoryOverrides<Deps, Base, Ext> = Pick<
    ValidFactories<Merge<Base, Ext>>,
    keyof Ext
> &
    Partial<Factories<Deps>>

/**
 * Validate that the dependencies of a factory are not cyclical and that the return type of the
 * dependency is a subtype of what's needed.
 */
export type ValidProviderDependencies<Deps, Dm> = Deps extends object
    ? {
          readonly [K in keyof Deps]: K extends keyof Dm
              ? Dm[K] extends Factory<infer R>
                  ? R extends Deps[K]
                      ? K extends FlattenDependencies<Dm, K>
                          ? NeverCyclicDependency<K, FlattenDependencies<Dm, K>>
                          : Deps[K]
                      : NeverWrongDependencyType<ReturnType<Dm[K]>, Deps[K]>
                  : NeverMissingDependency<K>
              : NeverMissingDependency<K>
      }
    : NeverInvalidDependenciesType

/**
 * Flattens the dependency graph for the given dependency factory.
 * E.g. given a map:
 * ```
 * type Map = {
 *     a: () => 1,
 *     b: (deps: { a: number }) => 2,
 *     c: () => 3,
 *     d: (deps: { b: number, c: number }) => 4,
 * }
 * ```
 *
 * `FlattenDependencies<'d', Map> // 'c' | 'b' | 'a'`
 */
export type FlattenDependencies<
    Dm,
    K extends keyof Dm,
    Current extends keyof Dm = never,
> = Dm[K] extends () => any
    ? never
    : Dm[K] extends (deps: infer Expected) => any
      ? keyof Expected extends Current
          ? never
          :
                | keyof Expected
                | FlattenDependencies<
                      Dm,
                      keyof Expected & keyof Dm,
                      Current | (keyof Expected & keyof Dm)
                  >
      : never
