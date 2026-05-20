/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type ExpectedInputType,
    type Factories,
    type FlattenDependencies,
    type NeverCyclicDependency,
    type NeverInvalidDependenciesType,
    type NeverMissingDependency,
    type NeverWrongDependencyType,
    validateFactories,
    type ValidFactories,
    type ValidFactoryOverrides,
} from '@amazon/vinyl-di'
import {
    expectNothing,
    expectTypeEquals,
    expectTypeExtends,
    expectTypeStrictlyEquals,
} from '@amazon/vinyl-util/browserTestUtil'
import type { AddDisposable, AnyRecord } from '@amazon/vinyl-util'

describe('validation', () => {
    describe('FlattenDependencies', () => {
        it('flattens recursive dependencies into a union of keys', () => {
            {
                type Factories = {
                    a: () => 1
                    b: (deps: { a: number }) => 2
                    c: () => 3
                    d: (deps: { b: number; c: number }) => 4
                }
                type Flattened = FlattenDependencies<Factories, 'd'>
                expectTypeStrictlyEquals<'b' | 'c' | 'a', Flattened>(true)
            }
            {
                type Factories = {
                    a: () => 1
                    b: () => 1
                    c: (deps: { a: number; b: number }) => 1
                    d: () => 1
                    e: (deps: { d: number; c: number }) => 1
                    f: (deps: { e: number }) => 1
                }
                expectTypeStrictlyEquals<
                    'a' | 'b',
                    FlattenDependencies<Factories, 'c'>
                >(true)
                expectTypeStrictlyEquals<
                    never,
                    FlattenDependencies<Factories, 'd'>
                >(true)
                expectTypeStrictlyEquals<
                    'e' | 'd' | 'c' | 'b' | 'a',
                    FlattenDependencies<Factories, 'f'>
                >(true)
            }
        })

        it('does not recurse past a cycle upon the initial key', () => {
            type Factories = {
                a: (deps: { d: number }) => 1
                b: (deps: { a: number }) => 2
                c: () => 3
                d: (deps: { b: number; c: number }) => 4
            }
            type Flattened = FlattenDependencies<Factories, 'd'>
            expectTypeStrictlyEquals<'b' | 'c' | 'a' | 'd', Flattened>(true)
        })
    })

    describe('validateFactories', () => {
        it('compile-time validates that a dependency map is valid', () => {
            validateFactories({
                a: () => 3,
                b: () => 'test',
                c: () => 'test 2',
            })

            validateFactories({
                // @ts-expect-error Expected NeverWrongReturnType
                a: () => 3,
                // @ts-expect-error Expected NeverWrongDependencyType error
                b: (_: { a: string }) => 'test',
                c: () => 'test 2',
            })
            expect({ a: 3 }).toEqual({ a: 3 })

            validateFactories({
                a: () => 'test',
                b: (_: { a: string }) => () => 3,
            })

            validateFactories({
                // @ts-expect-error Expected factory map
                a: 0,
            })

            validateFactories({
                a: (_d: AnyRecord, _add: AddDisposable) => 3 as const,
                b: (_deps: { readonly a: 3 }) => 4,
            })
        })

        it('validates that factories do not return void', () => {
            validateFactories({
                // @ts-expect-error Expected NeverNoVoidReturnType error
                a: () => void 0,
            })
            expectNothing()
        })

        it('allows factories that return null', () => {
            validateFactories({
                a: () => null,
                b: (deps: { a: number | null }) => deps.a,
                c: (_deps: { b: number | null }) => 3,
            })

            validateFactories({
                a: (): null | number => null,
            })

            expectNothing()
        })
    })

    describe('ValidFactories', () => {
        it('validates that all dependencies exist', () => {
            {
                type Factories = {
                    readonly a: () => 1
                    readonly b: (deps: { a: number }) => 2
                    readonly c: (deps: { b: number; a: number }) => 3
                    readonly d: (deps: { b: number; invalid: number }) => 4
                }
                type ValidatedMap = ValidFactories<Factories>
                expectTypeEquals<ValidatedMap['a'], Factories['a']>(true)
                expectTypeEquals<ValidatedMap['b'], Factories['b']>(true)
                expectTypeEquals<ValidatedMap['c'], Factories['c']>(true)
                expectTypeEquals<ValidatedMap['d'], Factories['d']>(false)
                expectTypeExtends<
                    Parameters<ValidatedMap['d']>[0],
                    {
                        invalid: NeverMissingDependency<any>
                        b: number
                    }
                >(true)
            }
        })

        it('validates that dependencies are not cyclical', () => {
            {
                type Factories = {
                    readonly a: () => 1
                    readonly b: (deps: { a: number }) => 2
                    readonly c: (deps: { b: number; a: number; e: number }) => 3
                    readonly d: (deps: { d: number }) => 4
                    readonly e: (deps: { a: number; c: number }) => 5
                }
                type ValidatedMap = ValidFactories<Factories>

                expectTypeEquals<ValidatedMap['a'], Factories['a']>(true)
                expectTypeEquals<ValidatedMap['b'], Factories['b']>(true)
                // c depends on e which depends on c
                expectTypeEquals<ValidatedMap['c'], Factories['c']>(false)
                expectTypeExtends<
                    Parameters<ValidatedMap['c']>[0],
                    {
                        a: number
                        b: number
                        e: NeverCyclicDependency<any, any>
                    }
                >(true)
                // d depends on d
                expectTypeEquals<ValidatedMap['d'], Factories['d']>(false)
                expectTypeExtends<
                    Parameters<ValidatedMap['d']>[0]['d'],
                    NeverCyclicDependency<any, any>
                >(true)
                // e depends on c which depends on e
                expectTypeEquals<ValidatedMap['e'], Factories['e']>(false)
                expectTypeExtends<
                    Parameters<ValidatedMap['e']>[0]['c'],
                    NeverCyclicDependency<any, any>
                >(true)
            }
        })

        it('validates that dependencies provide subtype', () => {
            {
                type Factories = {
                    readonly a: () => 1
                    readonly b: (deps: { readonly a: number }) => 2
                    readonly c: (deps: { readonly a: string }) => 3
                    readonly d: (deps: { readonly c: number }) => 5
                    readonly e: (deps: { readonly c: string }) => 6
                }
                type ValidatedMap = ValidFactories<Factories>
                expectTypeEquals<ValidatedMap['b'], Factories['b']>(true)
                expectTypeEquals<ValidatedMap['c'], Factories['c']>(false)
                expectTypeEquals<ValidatedMap['d'], Factories['d']>(true)
                expectTypeEquals<ValidatedMap['e'], Factories['e']>(false)
                expectTypeExtends<
                    Parameters<ValidatedMap['e']>[0]['c'],
                    NeverWrongDependencyType<any, any>
                >(true)
            }
        })

        it('validates that provider dependencies are objects', () => {
            {
                type Factories = {
                    readonly a: () => 1
                    readonly b: (deps: number) => 2
                }
                type ValidatedMap = ValidFactories<Factories>
                expectTypeEquals<ValidatedMap['b'], Factories['b']>(false)
                expectTypeEquals<
                    ValidatedMap['b'],
                    (deps: NeverInvalidDependenciesType) => 2
                >(true)
            }
        })

        it('validates all properties', () => {
            type Factories = {
                readonly a: () => 1
                readonly b: () => 'string'
                readonly c: (deps: {
                    readonly b: number
                    readonly a: number
                }) => 1
                readonly d: (deps: { readonly c: number }) => 1
            }
            type ValidatedMap = ValidFactories<Factories>
            type Expected = {
                readonly a: ValidatedMap['a']
                readonly b: ValidatedMap['b']
                readonly c: ValidatedMap['c']
                readonly d: ValidatedMap['d']
            }
            expectTypeStrictlyEquals<ValidFactories<Factories>, Expected>(true)
        })
    })

    describe('ExpectedInputType', () => {
        it('extracts all expected dependency types for a factory key', () => {
            expectTypeStrictlyEquals<
                ExpectedInputType<
                    {
                        k: () => 3
                        a: (deps: { k: number }) => 0
                    },
                    'k'
                >,
                number
            >(true)

            expectTypeStrictlyEquals<
                ExpectedInputType<
                    {
                        k: () => 3
                        a: (deps: { k: number }) => 0
                        b: (deps: { k: 3 }) => 0
                    },
                    'k'
                >,
                3
            >(true)
        })

        it('provides any type if there are no dependents', () => {
            expectTypeStrictlyEquals<
                ExpectedInputType<
                    {
                        k: () => 3
                        a: (deps: { b: number }) => 0
                    },
                    'k'
                >,
                any
            >(true)

            expectTypeStrictlyEquals<
                ExpectedInputType<
                    {
                        a: () => null | number
                    },
                    'a'
                >,
                any
            >(true)
        })
    })

    describe('ValidFactoryOverrides', () => {
        type BaseFactories = {
            readonly a: () => number
            readonly b: (deps: { readonly a: number }) => string
            readonly c: (deps: { readonly b: string }) => boolean
        }

        interface Deps {
            readonly c: boolean
        }

        function override<const Overrides extends Factories>(
            _: ValidFactoryOverrides<Deps, BaseFactories, Overrides>
        ) {}

        it('validates that dependency factories are valid after replacement', () => {
            override({
                a: () => 3 as const, // valid, 3 is a subtype of required number
                d: (_deps: {
                    // a valid input after the override
                    readonly a: 3
                }) => 4,
            } as const)

            override({
                // @ts-expect-error Expect NeverWrongReturnType
                a: () => '',
            } as const)

            override({
                a: () => 'a', // valid, factory with input dependency was also changed
                b: (_deps: {
                    // a valid input after the override
                    readonly a: string
                }) => 'b',
            } as const)

            expectNothing() // compile-time check
        })
    })
})
