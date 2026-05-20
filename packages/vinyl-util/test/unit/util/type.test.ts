/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type Contravariant,
    contravariant,
    type Covariant,
    covariant,
    type ElementType,
    type ExcludeValues,
    type ExtractValues,
    type Flatten,
    type FromTypeof,
    type Fun,
    type Invariant,
    invariant,
    type IsAny,
    type IsNever,
    type IsPropertyOptional,
    type Json,
    jsonCompatible,
    type NonFunctionPropertyNames,
    type OmitDeep,
    type Optional,
    type OptionalDeep,
    type PartialDeep,
    type PickPartial,
    type SetElementType,
} from '@amazon/vinyl-util'
import {
    expectNothing,
    expectTypeEquals,
    expectTypeExtends,
    expectTypeStrictlyEquals,
} from '@amazon/vinyl-util/browserTestUtil'

describe('type', () => {
    describe('Flatten', () => {
        it('distributes an array of values to a union type', () => {
            expectTypeStrictlyEquals<
                Flatten<['one', 2, true]>,
                'one' | 2 | true
            >(true)
            expectTypeStrictlyEquals<Flatten<[]>, never>(true)
        })

        it('works with readonly arrays', () => {
            expectTypeStrictlyEquals<
                Flatten<readonly ['one', 2, true]>,
                'one' | 2 | true
            >(true)
        })
    })

    describe('NonFunctionPropertyNames', () => {
        it('extracts property names whose values are not functions', () => {
            expectTypeStrictlyEquals<
                NonFunctionPropertyNames<{
                    a: 3
                    b: 'b'
                    c: () => void
                }>,
                'a' | 'b'
            >(true)
        })
    })

    describe('jsonCompatible', () => {
        it('enforces compatibility with JSON.stringify', () => {
            jsonCompatible({})
            jsonCompatible(true)
            if (typeof BigInt !== 'undefined') {
                // @ts-expect-error Expected error
                jsonCompatible(BigInt('1'))
            }
            // @ts-expect-error Expected error
            jsonCompatible(null as any)
            jsonCompatible(null)
            jsonCompatible(undefined)
            // @ts-expect-error Expected error
            jsonCompatible(null as unknown)
            jsonCompatible({
                a: 1,
                b: 'b',
                c: true,
                d: {
                    a: 1,
                    b: 'b',
                    c: false,
                },
            })
            // @ts-expect-error Expected error
            jsonCompatible(() => {})

            jsonCompatible({
                // @ts-expect-error Expected error
                f: () => {},
            })

            jsonCompatible({
                a: {
                    // @ts-expect-error Expected error
                    f: () => {},
                },
            })

            jsonCompatible({
                toJSON(): Json {
                    return {}
                },
            } as const)

            class F {
                toString() {}
                toJSON(): Json {
                    return { a: 3 }
                }
            }

            jsonCompatible(new F())
            jsonCompatible({ a: new F() })

            // Compile-time checks only
            expectNothing()
        })
    })

    describe('PartialDeep', () => {
        it('changes properties to optional for objects and nested objects', () => {
            expectTypeStrictlyEquals<PartialDeep<object>, object>(true)
            expectTypeStrictlyEquals<
                PartialDeep<{
                    readonly a: number
                }>,
                {
                    readonly a?: number
                }
            >(true)

            expectTypeStrictlyEquals<
                PartialDeep<{
                    readonly a: () => void
                }>,
                {
                    readonly a?: () => void
                }
            >(true)

            expectTypeStrictlyEquals<
                PartialDeep<{
                    readonly a: {
                        b: number
                        c: string
                    }
                }>,
                {
                    readonly a?: {
                        b?: number
                        c?: string
                    }
                }
            >(true)
        })
    })

    describe('PickPartial', () => {
        it('specifies properties of T that are not required', () => {
            type O = {
                a: string
                b: number
                c: number[]
            }
            expectTypeEquals<
                PickPartial<O, 'a'>,
                { a?: string; b: number; c: number[] }
            >(true)

            expectTypeEquals<
                PickPartial<O, 'a' | 'c'>,
                { a?: string; b: number; c?: number[] }
            >(true)
        })
    })

    describe('ExtractValues', () => {
        it('extracts an object whose values extend type U', () => {
            expectTypeEquals<
                ExtractValues<
                    {
                        key1: 'test'
                        key2: string
                        key3: number
                        key4: true
                    },
                    string
                >,
                {
                    key1: 'test'
                    key2: string
                }
            >(true)
        })
    })

    describe('ExcludeValues', () => {
        it('extracts an object whose values do not extend type U', () => {
            expectTypeEquals<
                ExcludeValues<
                    {
                        key1: 'test'
                        key2: string
                        key3: number
                        key4: true
                    },
                    string
                >,
                {
                    key3: number
                    key4: true
                }
            >(true)
        })
    })

    describe('ElementType', () => {
        it('infers the array element type', () => {
            expectTypeStrictlyEquals<ElementType<number[]>, number>(true)
            expectTypeStrictlyEquals<
                ElementType<(number | string)[]>,
                number | string
            >(true)
        })
    })

    describe('SetElementType', () => {
        it('infers the set element type', () => {
            expectTypeStrictlyEquals<
                SetElementType<ReadonlySet<number>>,
                number
            >(true)
            expectTypeStrictlyEquals<
                SetElementType<Set<number | string>>,
                number | string
            >(true)
        })
    })

    describe('Invariant', () => {
        it(`is a type that is invariant on type parameter T`, () => {
            expectTypeExtends<Invariant<3>, Invariant<number>>(false)
            expectTypeExtends<Invariant<number>, Invariant<3>>(false)
            expectTypeExtends<
                Invariant<{ a: number }>,
                Invariant<{ a: number; b?: number }>
            >(false)
            expectTypeExtends<
                Invariant<{ a: number; b?: number }>,
                Invariant<{ a: number }>
            >(false)
            expectTypeExtends<
                Invariant<{ a: number; b: { c: number } }>,
                Invariant<{ a: number; b: { c?: number } }>
            >(false)
            expectTypeExtends<
                Invariant<{ a: number; b: { c?: number } }>,
                Invariant<{ a: number; b: { c: number } }>
            >(false)
            expectTypeExtends<
                Invariant<(input: 3) => void>,
                Invariant<(input: number) => void>
            >(false)
            expectTypeExtends<
                Invariant<(input: number) => number>,
                Invariant<(input: number) => 3>
            >(false)
        })

        it('is assignable when T is type any', () => {
            expectTypeExtends<Invariant<any>, Invariant<{ a: number }>>(true)
            expectTypeExtends<Invariant<{ a: number }>, Invariant<any>>(true)
            expectTypeExtends<Invariant<() => any>, () => number>(true)
        })

        it('can be used as a member of an object for invariance', () => {
            interface Foo<T> {
                prop: Invariant<T>
            }
            type S = {
                a: number
            }
            type T = S & {
                b?: number
            }
            expectTypeExtends<Foo<S>, Foo<T>>(false)
            expectTypeExtends<Foo<T>, Foo<S>>(false)
            expectTypeExtends<Foo<T>, Foo<T>>(true)
        })
    })

    describe('invariant', () => {
        it('returns undefined with type Invariant', () => {
            const v = invariant<string>()
            expect(v).toBeUndefined()
            expectTypeStrictlyEquals<typeof v, Invariant<string>>(true)
        })

        it('can be used as a property to ensure invariance', () => {
            type A = {
                a: number
            }
            type B = A & {
                b?: number
            }
            let _b = {
                __type: invariant<B>(),
            }
            _b = {
                // @ts-expect-error Expected type A not to be assignable to B
                __type: invariant<A>(),
            }
            _b = {
                __type: invariant<B>(),
            }

            let _a = {
                __type: invariant<A>(),
            }
            _a = {
                // @ts-expect-error Expected type B not to be assignable to A
                __type: invariant<B>(),
            }
            _a = {
                __type: invariant<A>(),
            }
            expectNothing()
        })
    })

    describe('FromTypeOf', () => {
        it('returns the type a value must be when passed to typeof', () => {
            expectTypeStrictlyEquals<FromTypeof<'boolean'>, boolean>(true)
            expectTypeStrictlyEquals<FromTypeof<'function'>, Fun>(true)
            expectTypeStrictlyEquals<FromTypeof<'number'>, number>(true)
            expectTypeStrictlyEquals<FromTypeof<'object'>, object | null>(true)
            expectTypeStrictlyEquals<FromTypeof<'string'>, string>(true)
            expectTypeStrictlyEquals<FromTypeof<'symbol'>, symbol>(true)
            expectTypeStrictlyEquals<FromTypeof<'undefined'>, undefined>(true)
        })
    })

    describe('variance helpers', () => {
        interface Polygon {
            readonly numSides: number
        }
        interface Square extends Polygon {
            readonly numSides: 4
        }

        describe('invariant', () => {
            it('enforces a type to be invariant', () => {
                interface InvariantOnT<T> {
                    value: Invariant<T>
                }
                expectTypeExtends<InvariantOnT<Polygon>, InvariantOnT<Square>>(
                    false
                )
                expectTypeExtends<InvariantOnT<Square>, InvariantOnT<Polygon>>(
                    false
                )
                const _invariantPolygon = invariant<Polygon>()
                const _invariantSquare = invariant<Square>()
                expectTypeExtends<
                    typeof _invariantPolygon,
                    typeof _invariantSquare
                >(false)
                expectTypeExtends<
                    typeof _invariantSquare,
                    typeof _invariantPolygon
                >(false)
                expectTypeExtends<
                    typeof _invariantPolygon,
                    typeof _invariantPolygon
                >(true)
            })
        })

        describe('covariant', () => {
            it('enforces a type to be covariant', () => {
                interface CovariantOnT<T> {
                    value: Covariant<T>
                }
                expectTypeExtends<CovariantOnT<Polygon>, CovariantOnT<Square>>(
                    false
                )
                expectTypeExtends<CovariantOnT<Square>, CovariantOnT<Polygon>>(
                    true
                )
                const _covariantPolygon = covariant<Polygon>()
                const _covariantSquare = covariant<Square>()
                expectTypeExtends<
                    typeof _covariantPolygon,
                    typeof _covariantSquare
                >(false)
                expectTypeExtends<
                    typeof _covariantSquare,
                    typeof _covariantPolygon
                >(true)
                expectTypeExtends<
                    typeof _covariantPolygon,
                    typeof _covariantPolygon
                >(true)
            })
        })

        describe('contravariant', () => {
            it('enforces a type to be contravariant', () => {
                interface ContravariantOnT<T> {
                    value: Contravariant<T>
                }
                expectTypeExtends<
                    ContravariantOnT<Polygon>,
                    ContravariantOnT<Square>
                >(true)
                expectTypeExtends<
                    ContravariantOnT<Square>,
                    ContravariantOnT<Polygon>
                >(false)
                const _contraVariantPolygon = contravariant<Polygon>()
                const _contravariantSquare = contravariant<Square>()
                expectTypeExtends<
                    typeof _contraVariantPolygon,
                    typeof _contravariantSquare
                >(true)
                expectTypeExtends<
                    typeof _contravariantSquare,
                    typeof _contraVariantPolygon
                >(false)
                expectTypeExtends<
                    typeof _contraVariantPolygon,
                    typeof _contraVariantPolygon
                >(true)
            })
        })
    })

    describe('OmitDeep', () => {
        it('removes specified keys from type recursively', () => {
            type Foo = {
                remove1: number
                bar: {
                    remove1: number
                    remove2: number
                    value: string
                    baz: {
                        remove1: string
                        remove2: string
                        value: number
                    }
                }
            }
            expectTypeStrictlyEquals<
                OmitDeep<Foo, 'remove1' | 'remove2'>,
                {
                    bar: {
                        value: string
                        baz: {
                            value: number
                        }
                    }
                }
            >(true)
        })
    })

    describe('Optional', () => {
        it('defines keys extending K as not required', () => {
            type Foo = {
                required1: number
                readonly required2: {
                    foo: number
                }
                readonly required3: string
                alreadyOptional?: number
            }

            expectTypeEquals<
                Optional<Foo, 'required2' | 'required3'>,
                {
                    required1: number
                    readonly required2?: {
                        foo: number
                    }
                    readonly required3?: string
                    alreadyOptional?: number
                }
            >(true)

            // @ts-expect-error Should not compile, 'non-existent' is not a key of Foo:
            function foo(): Optional<Foo, 'non-existent'> {}
            foo()
        })
    })

    describe('OptionalDeep', () => {
        it('defines keys extending K as not required recursively', () => {
            type Foo = {
                required1: number
                readonly required2: {
                    foo: number
                    required1: string
                    readonly required2: {
                        bar: string
                    }
                }
                readonly required3: string
                alreadyOptional?: number
            }

            expectTypeEquals<
                OptionalDeep<Foo, 'required2' | 'required3'>,
                {
                    required1: number
                    readonly required2?: {
                        foo: number
                        required1: string
                        readonly required2?: {
                            bar: string
                        }
                    }
                    readonly required3?: string
                    alreadyOptional?: number
                }
            >(true)
        })
    })

    describe('IsNever', () => {
        it('returns type true for never', () => {
            expectTypeStrictlyEquals<IsNever<never>, true>(true)
            expectTypeStrictlyEquals<IsNever<3 & 1>, true>(true)
            expectTypeStrictlyEquals<IsNever<1>, false>(true)
            expectTypeStrictlyEquals<IsNever<any>, false>(true)
            expectTypeStrictlyEquals<IsNever<unknown>, false>(true)
            expectTypeStrictlyEquals<IsNever<never | any>, false>(true)
        })
    })

    describe('IsAny', () => {
        it('returns type true for any', () => {
            expectTypeStrictlyEquals<IsAny<never>, false>(true)
            expectTypeStrictlyEquals<IsAny<never | any>, true>(true)
            expectTypeStrictlyEquals<IsAny<1>, false>(true)
            expectTypeStrictlyEquals<IsAny<any>, true>(true)
            expectTypeStrictlyEquals<IsAny<unknown>, false>(true)
        })
    })

    describe('IsPropertyOptional', () => {
        it('returns type true if property is optional', () => {
            expectTypeStrictlyEquals<
                IsPropertyOptional<
                    {
                        foo: number
                    },
                    'foo'
                >,
                false
            >(true)
            expectTypeStrictlyEquals<
                IsPropertyOptional<
                    {
                        foo?: number
                    },
                    'foo'
                >,
                true
            >(true)
            expectTypeStrictlyEquals<
                IsPropertyOptional<
                    {
                        foo: number | undefined
                    },
                    'foo'
                >,
                false
            >(true)
            expectTypeStrictlyEquals<
                IsPropertyOptional<
                    {
                        foo?: number | undefined
                    },
                    'foo'
                >,
                true
            >(true)
        })
    })
})
