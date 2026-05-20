/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Equal, StrictEqual } from '@amazon/vinyl-util/browserTestUtil'
import {
    expectTypeExtends,
    expectTypeFalse,
    expectTypeStrictlyEquals,
    expectTypeTrue,
} from '@amazon/vinyl-util/browserTestUtil'

describe('expectTypeTrue', () => {
    it('compiles when type is exactly true', () => {
        expectTypeTrue<true>()
        // @ts-expect-error Should not compile
        expectTypeTrue<true | false>()
    })
})

describe('expectTypeFalse', () => {
    it('compiles when type is exactly true', () => {
        expectTypeFalse<false>()
        // @ts-expect-error Should not compile
        expectTypeFalse<true | false>()
    })
})

describe('expectTypeExtends', () => {
    it('matches true when T extends U', () => {
        expectTypeExtends<1, number>(true)
        expectTypeExtends<1 | 2, 1 | 2>(true)
        expectTypeExtends<1, 1 | 2>(true)
        expectTypeExtends<1 | 2, number>(true)
        expectTypeExtends<1 | 2 | number, number>(true)
        expectTypeExtends<1, any>(true)
        expectTypeExtends<any, 1>(true)
        expectTypeExtends<1, unknown>(true)
        expectTypeExtends<never, 1>(true)
    })

    it('matches false when T does not extend U', () => {
        expectTypeExtends<unknown, 1>(false)
        expectTypeExtends<number, 1>(false)
        expectTypeExtends<1 | 2, 1>(false)
        expectTypeExtends<1, never>(false)
    })
})

describe('StrictEqual', () => {
    it('matches special types', () => {
        expectTypeTrue<StrictEqual<unknown, unknown>>()
        expectTypeTrue<StrictEqual<any, any>>()
        expectTypeTrue<StrictEqual<never, never>>()
        expectTypeFalse<StrictEqual<any, never>>()
        expectTypeFalse<StrictEqual<any, unknown>>()
        expectTypeFalse<StrictEqual<never, any>>()
        expectTypeFalse<StrictEqual<never, unknown>>()
        expectTypeFalse<StrictEqual<unknown, any>>()
        expectTypeFalse<StrictEqual<unknown, never>>()
    })

    it('matches primitive types', () => {
        expectTypeTrue<StrictEqual<1, 1>>()
        expectTypeFalse<StrictEqual<1, 2>>()
        expectTypeFalse<StrictEqual<'1', 1>>()
        expectTypeTrue<StrictEqual<'1', '1'>>()
    })

    it('matches function types', () => {
        expectTypeTrue<StrictEqual<() => void, () => void>>()
        expectTypeTrue<
            StrictEqual<
                (arg1: 1, arg2: 2, arg3: 3) => void,
                (arg1: 1, arg2: 2, arg3: 3) => void
            >
        >()
        expectTypeFalse<
            StrictEqual<
                (arg1: 1, arg2: 2, arg3: 3) => void,
                (arg1: 1, arg2: 2, arg3: 4) => void
            >
        >()
        expectTypeFalse<StrictEqual<() => boolean, () => string>>()
        expectTypeFalse<StrictEqual<() => any, () => unknown>>()
        expectTypeFalse<
            StrictEqual<(...args: any) => void, (arg1: 1) => void>
        >()
        expectTypeFalse<
            StrictEqual<(...args: 1[]) => void, (arg1: 1) => void>
        >()
    })

    it('matches constructor types', () => {
        expectTypeTrue<
            StrictEqual<abstract new () => void, abstract new () => void>
        >()
        expectTypeFalse<StrictEqual<new () => void, new () => number>>()
        expectTypeFalse<StrictEqual<new (arg: 1) => void, new () => void>>()
        expectTypeFalse<
            StrictEqual<new (...arg: 1[]) => void, new () => void>
        >()
        expectTypeFalse<StrictEqual<new () => void, abstract new () => void>>()
    })

    it('matches arrays', () => {
        expectTypeTrue<StrictEqual<[0, 1], [0, 1]>>()
        expectTypeFalse<StrictEqual<[1, 0], [0, 1]>>()
        expectTypeFalse<StrictEqual<[0, 1, 2], [0, 1]>>()
        expectTypeFalse<StrictEqual<[any, any], [0, 1]>>()
    })

    it('matches objects', () => {
        expectTypeTrue<StrictEqual<{ a: 1 }, { a: 1 }>>()
        expectTypeFalse<StrictEqual<{ a: 1 }, { a: 1; b: 2 }>>()
        expectTypeTrue<
            StrictEqual<{ a: 1; b: { c: 2 } }, { b: { c: 2 }; a: 1 }>
        >()
        expectTypeFalse<
            StrictEqual<{ a: 1; b: { c: 2 } }, { b: { c: 42 }; a: 1 }>
        >()
        expectTypeTrue<StrictEqual<{ a: 1; b: [1, 2] }, { a: 1; b: [1, 2] }>>()
        expectTypeFalse<StrictEqual<{ readonly a: 1 }, { a: 1 }>>()
    })

    it('matches union types', () => {
        expectTypeTrue<StrictEqual<1 | 2, 1 | 2>>()
        expectTypeTrue<StrictEqual<1 | 2, 2 | 1>>()
        expectTypeFalse<StrictEqual<1 | never, never>>()
        expectTypeTrue<StrictEqual<1 | 2 | any, 1 | 2 | any>>()
        expectTypeFalse<StrictEqual<1 | 2 | any, 1 | 2 | never>>()
        expectTypeTrue<StrictEqual<{ a: 1 } | { a: 2 }, { a: 1 } | { a: 2 }>>()
        expectTypeFalse<StrictEqual<{ a: 1 } | { a: 2 }, { a: 1 }>>()
        expectTypeFalse<StrictEqual<{ a: 1 } | { a: 2 }, { a: 1 | 2 }>>()
    })

    it('matches intersection types', () => {
        expectTypeTrue<StrictEqual<1 & 2, 2 & 1>>()
        expectTypeTrue<StrictEqual<1 & 2, never>>()
        expectTypeTrue<StrictEqual<number & 2, 2>>()
        expectTypeFalse<
            StrictEqual<{ foo: 3 } & { bar: 4; foo: 3 }, { foo: 3 }>
        >()
        expectTypeTrue<
            StrictEqual<
                { foo: 3 } & { bar: 4; foo: 3 },
                { bar: 4; foo: 3 } & { foo: 3 }
            >
        >()
        expectTypeTrue<StrictEqual<{ bar: 4; foo: 3 } & never, never>>()
    })
})

describe('Equal', () => {
    it('matches special types', () => {
        expectTypeTrue<Equal<unknown, unknown>>()
        expectTypeTrue<Equal<any, any>>()
        expectTypeTrue<Equal<never, never>>()
        expectTypeTrue<Equal<any, unknown>>()
        expectTypeTrue<Equal<unknown, any>>()
        expectTypeFalse<Equal<any, never>>()
        expectTypeFalse<Equal<never, any>>()
        expectTypeFalse<Equal<never, unknown>>()
        expectTypeFalse<Equal<unknown, never>>()
    })

    it('matches primitive types', () => {
        expectTypeTrue<Equal<1, 1>>()
        expectTypeFalse<Equal<1, 2>>()
        expectTypeFalse<Equal<'1', 1>>()
        expectTypeTrue<Equal<'1', '1'>>()
    })

    it('matches function types', () => {
        expectTypeTrue<Equal<() => void, () => void>>()
        expectTypeTrue<
            Equal<
                (arg1: 1, arg2: 2, arg3: 3) => void,
                (arg1: 1, arg2: 2, arg3: 3) => void
            >
        >()
        expectTypeFalse<
            Equal<
                (arg1: 1, arg2: 2, arg3: 3) => void,
                (arg1: 1, arg2: 2, arg3: 4) => void
            >
        >()
        expectTypeFalse<Equal<() => boolean, () => string>>()
        expectTypeTrue<Equal<() => any, () => unknown>>()
        expectTypeTrue<Equal<(...args: any) => void, (arg1: 1) => void>>()
        expectTypeTrue<Equal<(...args: 1[]) => void, (arg1: 1) => void>>()
    })

    it('matches constructor types', () => {
        expectTypeTrue<
            Equal<abstract new () => void, abstract new () => void>
        >()
        expectTypeFalse<Equal<new () => void, new () => number>>()
        expectTypeFalse<Equal<new (arg: 1) => void, new () => void>>()
        expectTypeTrue<Equal<new (...arg: 1[]) => void, new () => void>>()
        expectTypeFalse<Equal<new () => void, abstract new () => void>>()
    })

    it('matches arrays', () => {
        expectTypeTrue<Equal<[0, 1], [0, 1]>>()
        expectTypeFalse<Equal<[0, 1, 2], [0, 1]>>()
        expectTypeTrue<Equal<[any, any], [0, 1]>>()
    })

    it('matches objects', () => {
        expectTypeTrue<Equal<{ a: 1 }, { a: 1 }>>()
        expectTypeFalse<Equal<{ a: 1 }, { a: 1; b: 2 }>>()
        expectTypeTrue<Equal<{ a: 1; b: { c: 2 } }, { b: { c: 2 }; a: 1 }>>()
        expectTypeFalse<Equal<{ a: 1; b: { c: 2 } }, { b: { c: 42 }; a: 1 }>>()
        expectTypeTrue<Equal<{ a: 1; b: [1, 2] }, { a: 1; b: [1, 2] }>>()
        expectTypeTrue<Equal<{ readonly a: 1 }, { a: 1 }>>()
    })

    it('matches union types', () => {
        expectTypeTrue<Equal<1 | 2, 1 | 2>>()
        expectTypeTrue<Equal<1 | 2, 2 | 1>>()
        expectTypeFalse<Equal<1 | never, never>>()
        expectTypeTrue<Equal<1 | 2 | any, 1 | 2 | any>>()
        expectTypeTrue<Equal<1 | 2 | any, 1 | 2 | never>>()
        expectTypeTrue<Equal<{ a: 1 } | { a: 2 }, { a: 1 } | { a: 2 }>>()
        expectTypeFalse<Equal<{ a: 1 } | { a: 2 }, { a: 1 }>>()
        expectTypeTrue<Equal<{ a: 1 } | { a: 2 }, { a: 1 | 2 }>>()
    })

    it('matches intersection types', () => {
        expectTypeTrue<Equal<1 & 2, 1 & 2>>()
        expectTypeTrue<Equal<1 & 2, never>>()
        expectTypeTrue<Equal<number & 2, 2>>()
        expectTypeFalse<Equal<{ foo: 3 } & { bar: 4; foo: 3 }, { foo: 3 }>>()
        expectTypeTrue<
            Equal<
                { foo: 3 } & { bar: 4; foo: 3 },
                { bar: 4; foo: 3 } & { foo: 3 }
            >
        >()
        expectTypeTrue<Equal<{ bar: 4; foo: 3 } & never, never>>()
    })
})

describe('expectTypeStrictEquals', () => {
    it('matches primitive types', () => {
        expectTypeStrictlyEquals<1, 1>(true)
        expectTypeStrictlyEquals<1, 2>(false)
        expectTypeStrictlyEquals<'1', 1>(false)
        expectTypeStrictlyEquals<'1', '1'>(true)
    })

    it('matches object types', () => {
        expectTypeStrictlyEquals<{ a: number }, { a: number }>(true)
        expectTypeStrictlyEquals<{ a: number }, { b: number }>(false)
        expectTypeStrictlyEquals<{ a: number }, { a: string }>(false)
        expectTypeStrictlyEquals<
            { a: number; b: { a: boolean } },
            { a: number; b: { a: boolean } }
        >(true)
        expectTypeStrictlyEquals<
            { a: number; b: { a: boolean } },
            { a: number; b: { a: boolean; b: string } }
        >(false)

        interface ComplexObjA {
            a: number
            b: { a: boolean; b: [true, false] }
        }

        expectTypeStrictlyEquals<ComplexObjA, ComplexObjA>(true)

        interface ComplexObjB {
            a: number
            b: { a: boolean; b: [true, false, true] }
        }

        expectTypeStrictlyEquals<ComplexObjA, ComplexObjB>(false)
    })

    it('matches array types', () => {
        expectTypeStrictlyEquals<[number, string], [number, string]>(true)
        expectTypeStrictlyEquals<[number, string], [number, number]>(false)
        expectTypeStrictlyEquals<string[], string[]>(true)
        expectTypeStrictlyEquals<string[], number[]>(false)
    })

    it('matches never', () => {
        expectTypeStrictlyEquals<never, never>(true)
        expectTypeStrictlyEquals<never, any>(false)
        expectTypeStrictlyEquals<never, unknown>(false)
        expectTypeStrictlyEquals<{ a: never }, { a: never }>(true)
        expectTypeStrictlyEquals<{ a: never }, { a: unknown }>(false)
    })

    it('matches unknown', () => {
        expectTypeStrictlyEquals<unknown, unknown>(true)
        expectTypeStrictlyEquals<unknown, any>(false)
        expectTypeStrictlyEquals<{ a: unknown }, { a: unknown }>(true)
        expectTypeStrictlyEquals<{ a: unknown }, { a: any }>(false)
    })

    it('matches any', () => {
        expectTypeStrictlyEquals<any, any>(true)
        expectTypeStrictlyEquals<any, never>(false)
        expectTypeStrictlyEquals<{ a: any }, { a: any }>(true)
    })

    it('differentiates between undefined and optional properties', () => {
        expectTypeStrictlyEquals<{ a: undefined }, { a: undefined }>(true)
        expectTypeStrictlyEquals<{ a?: undefined }, { a?: undefined }>(true)
        expectTypeStrictlyEquals<{ a?: undefined }, { a: undefined }>(false)
        expectTypeStrictlyEquals<
            { a: undefined | string },
            { a: undefined | string }
        >(true)
        expectTypeStrictlyEquals<
            { a: undefined | string },
            { a?: undefined | string }
        >(false)
    })

    it('distinguishes readonly from mutable properties', () => {
        expectTypeStrictlyEquals<{ readonly a: 1 }, { a: 1 }>(false)
        expectTypeStrictlyEquals<{ a: 1 }, { readonly a: 1 }>(false)
        expectTypeStrictlyEquals<readonly [number, string], [number, string]>(
            false
        )
    })

    it('matches function parameters accurately', () => {
        expectTypeStrictlyEquals<
            (a: number, b: string) => string,
            (a: number, b: string) => string
        >(true)
        expectTypeStrictlyEquals<
            (a: number, b: string) => string,
            (a: number, b: string) => false
        >(false)
        expectTypeStrictlyEquals<
            (a: number, b: any) => string,
            (a: number, b: string) => string
        >(false)
        expectTypeStrictlyEquals<
            (a: number, b?: string) => string,
            (a: number, b: string | undefined) => string
        >(false)
        expectTypeStrictlyEquals<
            (...a: number[]) => string,
            (a: number) => string
        >(false)
        expectTypeStrictlyEquals<(...a: any[]) => string, (a: any) => string>(
            false
        )
        expectTypeStrictlyEquals<(a: never) => never, (a: never) => never>(true)
        expectTypeStrictlyEquals<(a: never) => never, (a: any) => never>(false)
        expectTypeStrictlyEquals<(a: unknown) => never, (a: any) => never>(
            false
        )
        expectTypeStrictlyEquals<
            (...a: number[]) => string,
            (...a: number[]) => string
        >(true)

        interface ComplexObjA {
            a: (...args: string[]) => number
            b: {
                a: (a: string) => number
                b: (a: never) => any
                c: (a: string) => unknown
            }
        }

        expectTypeStrictlyEquals<ComplexObjA, ComplexObjA>(true)

        interface ComplexObjB {
            a: (...args: string[]) => number
            b: {
                a: (a: number) => number
                b: (a: never) => any
                c: (a: string) => unknown
            }
        }

        expectTypeStrictlyEquals<ComplexObjA, ComplexObjB>(false)

        interface ComplexObjC {
            a: (...args: string[]) => number
            b: {
                a: (a: string, ...b: string[]) => number
                b: (a: never) => any
                c: (a: string) => unknown
            }
        }

        expectTypeStrictlyEquals<ComplexObjA, ComplexObjC>(false)
        expectTypeStrictlyEquals<ComplexObjC, ComplexObjA>(false)

        interface ComplexObjD {
            a: (...args: string[]) => number
            b: {
                a: (a: string) => number
                b: (a: never, b?: never) => any
                c: (a: string) => unknown
            }
        }

        expectTypeStrictlyEquals<ComplexObjA, ComplexObjD>(false)
        expectTypeStrictlyEquals<ComplexObjD, ComplexObjA>(false)
    })
})
