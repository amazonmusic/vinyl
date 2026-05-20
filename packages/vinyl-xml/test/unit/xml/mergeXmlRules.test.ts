/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    AttributeRule,
    ElementsRule,
    LazyXmlRule,
    Merged,
    XmlRule,
    XmlRules,
} from '@amazon/vinyl-xml'
import {
    attrBoolean,
    attrFloat,
    attrInt,
    attrString,
    charactersString,
    element,
    elements,
    mergeXmlRules,
    XmlRuleType,
} from '@amazon/vinyl-xml'
import type { AnyRecord, ReadonlyDate } from '@amazon/vinyl-util'
import { stringify } from '@amazon/vinyl-util'
import {
    expectTypeEquals,
    expectTypeStrictlyEquals,
} from '@amazon/vinyl-util/browserTestUtil'
import objectContaining = jasmine.objectContaining
import any = jasmine.any

describe('mergeXmlRules', () => {
    it('merges keys', () => {
        const rules1 = {
            elements1: elements(
                {
                    number: attrInt,
                },
                {}
            ),
            chars: charactersString,
        }
        const rules2 = {
            number: attrFloat,
        }
        const merged = mergeXmlRules(rules1, rules2)
        expect(merged).toEqual({
            elements1: {
                type: XmlRuleType.ELEMENTS,
                localPart: undefined,
                namespaceUri: undefined,
                minOccurs: 0,
                maxOccurs: null,
                useEmptyArrays: false,
                rules: { number: attrInt },
            },
            chars: {
                type: XmlRuleType.CHARACTERS,
                parse: any(Function),
                stringify,
            },
            number: attrFloat,
        })
    })

    it('accepts up to five rule maps to merge', () => {
        const rules1 = {
            elements1: elements(
                {
                    number: attrInt(),
                    chars: charactersString,
                },
                {}
            ),
            chars: charactersString,
        }
        const rules2 = {
            number: attrFloat(),
        }
        const rules3 = {
            int: attrInt(),
        }
        const rules4 = {
            bool: attrBoolean(),
            chars: charactersString,
        }
        const rules5 = {
            elements1: elements(
                {
                    number: attrInt(),
                    string: charactersString,
                },
                {}
            ),
        }
        const merged = mergeXmlRules(rules1, rules2, rules3, rules4, rules5)
        expect(merged).toEqual({
            elements1: elements({
                number: attrInt(),
                chars: charactersString,
                string: charactersString,
            }),
            chars: charactersString,
            number: attrFloat(),
            int: attrInt(),
            bool: attrBoolean(),
        })
    })

    it('merges lazy rules', () => {
        interface Type {
            readonly number?: number
        }

        const lazyRules: XmlRules<Type> = {
            number: attrFloat,
        }
        const rules: XmlRules<Type> = {
            number: attrFloat(),
        }
        {
            // Both are lazy
            const merged = mergeXmlRules(lazyRules, lazyRules)

            expect<XmlRule<number>>(
                (merged.number as LazyXmlRule<number>)()
            ).toEqual(
                objectContaining({
                    type: XmlRuleType.ATTRIBUTE,
                })
            )
        }
        {
            // First is lazy
            const merged = mergeXmlRules(lazyRules, rules)

            expect<XmlRule<number>>(
                (merged.number as LazyXmlRule<number>)()
            ).toEqual(
                objectContaining({
                    type: XmlRuleType.ATTRIBUTE,
                })
            )
        }
        {
            // Second is lazy
            const merged = mergeXmlRules(rules, lazyRules)

            expect<XmlRule<number>>(
                (merged.number as LazyXmlRule<number>)()
            ).toEqual(
                objectContaining({
                    type: XmlRuleType.ATTRIBUTE,
                })
            )
        }
    })

    it('throws if merged rules are different types', () => {
        expect(() =>
            mergeXmlRules(
                {
                    number: attrFloat(),
                },
                {
                    number: element({}),
                }
            )
        ).toThrowError(
            'Cannot override the rule number of type attribute with a rule of type element'
        )

        expect(() => {
            type StrHolderRules = XmlRules<{ str?: string }>
            const rules1: StrHolderRules = {
                // Lazy rule
                str: () => charactersString,
            }
            const rules2: StrHolderRules = {
                str: attrString,
            }
            ;(mergeXmlRules(rules1, rules2).str as LazyXmlRule<string>)()
        }).toThrowError(
            'Cannot override the rule str of type characters with a rule of type attribute'
        )
    })

    it('throws if namespaceUri differs for the same property', () => {
        expect(() =>
            mergeXmlRules(
                {
                    number: attrFloat({ namespaceUri: 'example.com' }),
                },
                {
                    number: attrFloat(),
                }
            )
        ).toThrowError(
            'Cannot override the rule number with a different localPart or namespace'
        )

        expect(() =>
            mergeXmlRules(
                {
                    child: element({}, { namespaceUri: 'example.com' }),
                },
                {
                    child: element({}, { namespaceUri: 'example.com' }),
                }
            )
        ).not.toThrow()

        expect(() =>
            mergeXmlRules(
                {
                    child: element({}, { namespaceUri: 'apples' }),
                },
                {
                    child: element({}, { namespaceUri: 'oranges' }),
                }
            )
        ).toThrowError(
            'Cannot override the rule child with a different localPart or namespace'
        )

        expect(() =>
            mergeXmlRules(
                {
                    children: elements({}, { namespaceUri: 'apples' }),
                },
                {
                    children: elements({}, { namespaceUri: 'oranges' }),
                }
            )
        ).toThrowError(
            'Cannot override the rule children with a different localPart or namespace'
        )
    })

    it('throws if localPart differs for the same property', () => {
        expect(() =>
            mergeXmlRules(
                {
                    number: attrFloat({ localPart: 'different' }),
                },
                {
                    number: attrFloat(),
                }
            )
        ).toThrowError(
            'Cannot override the rule number with a different localPart or namespace'
        )

        expect(() =>
            mergeXmlRules(
                {
                    child: element({
                        a: attrFloat({ localPart: 'apples' }),
                    }),
                },
                {
                    child: element({
                        a: attrFloat({ localPart: 'oranges' }),
                    }),
                }
            )
        ).toThrowError(
            'Cannot override the rule a with a different localPart or namespace'
        )

        expect(() =>
            mergeXmlRules(
                {
                    // The default is the property name, if explicitly set to the default,
                    // expect not to throw.
                    number: attrFloat({ localPart: 'number' }),
                },
                {
                    number: attrFloat(),
                }
            )
        ).not.toThrow()
    })

    it('makes the rule required if either is required', () => {
        interface Type {
            a?: string
        }

        const rules1: XmlRules<Type> = {
            a: attrString(),
        }
        const rules2: XmlRules<Type> = {
            a: attrString({ required: true }),
        }
        const merged = mergeXmlRules(rules1, rules2)
        expect((merged.a as AttributeRule<string>).required).toBeTrue()
    })

    it('uses the default of the latter rule if defined', () => {
        interface Type {
            a?: string
        }

        const rules1: XmlRules<Type> = {
            a: attrString({ default: 'a' }),
        }
        const rules2: XmlRules<Type> = {
            a: attrString({ default: 'b' }),
        }
        const merged = mergeXmlRules(rules1, rules2)
        expect((merged.a as AttributeRule<string>).default).toBe('b')
    })

    it('uses the default of the former rule if no default for the latter', () => {
        interface Type {
            a?: string
        }

        const rules1: XmlRules<Type> = {
            a: attrString({ default: 'a' }),
        }
        const rules2: XmlRules<Type> = {
            a: attrString({ default: undefined }),
        }
        const merged = mergeXmlRules(rules1, rules2)
        expect((merged.a as AttributeRule<string>).default).toBe('a')
    })

    it('takes the max of minOccurs', () => {
        interface Type {
            a: readonly AnyRecord[]
        }

        const rules1: XmlRules<Type> = {
            a: elements({}, { minOccurs: 3 }),
        }
        const rules2: XmlRules<Type> = {
            a: elements({}, { minOccurs: 4 }),
        }

        const merged = mergeXmlRules(rules1, rules2)
        expect((merged.a as ElementsRule<any>).minOccurs).toBe(4)
    })

    it('takes the min of maxOccurs', () => {
        interface Type {
            a?: readonly AnyRecord[]
            b?: readonly AnyRecord[]
            c?: readonly AnyRecord[]
        }

        const rules1: XmlRules<Type> = {
            a: elements({}, { maxOccurs: 3 }),
            // null maxOccurs is unbounded (default)
            b: elements({}, { maxOccurs: null }),
            c: elements({}, { maxOccurs: 5 }),
        }
        const rules2: XmlRules<Type> = {
            a: elements({}, { maxOccurs: 4 }),
            b: elements({}, { maxOccurs: 5 }),
            c: elements({}, { maxOccurs: null }),
        }

        const merged = mergeXmlRules(rules1, rules2)
        expect((merged.a as ElementsRule<any>).maxOccurs).toBe(3)
        expect((merged.b as ElementsRule<any>).maxOccurs).toBe(5)
        expect((merged.c as ElementsRule<any>).maxOccurs).toBe(5)
    })
})

describe('Merged', () => {
    it('recursively distributes array element types', () => {
        expectTypeStrictlyEquals<
            Merged<number[] & string[]>,
            (number & string)[]
        >(true)
        expectTypeStrictlyEquals<
            Merged<{ foo: number[] } & { foo: string[] }>,
            { foo: (number & string)[] }
        >(true)
        expectTypeStrictlyEquals<
            Merged<{ foo: { a: number }[] } & { foo: { b: string }[] }>,
            { foo: { a: number; b: string }[] }
        >(true)
        expectTypeStrictlyEquals<
            Merged<
                {
                    foo: { a: number }[]
                } & {
                    foo: { b: string }[]
                }
            >,
            { foo: { a: number; b: string }[] }
        >(true)

        expectTypeStrictlyEquals<
            Merged<
                {
                    foo: { a: { c: number; e: number[] } }
                } & {
                    foo: { a: { d: number; e: string[] }; b: string }
                }
            >,
            {
                foo: {
                    a: { c: number; d: number; e: (string & number)[] }
                    b: string
                }
            }
        >(true)
    })

    it('retains readonly', () => {
        // A readonly array intersected with a mutable array results in a mutable array
        expectTypeStrictlyEquals<
            Merged<{ foo: number[] } & { foo: readonly number[] }>,
            { foo: number[] }
        >(true)

        expectTypeStrictlyEquals<
            Merged<
                { foo: readonly { readonly a: number }[] } & {
                    foo: readonly { readonly b: string }[]
                }
            >,
            { foo: readonly { readonly a: number; readonly b: string }[] }
        >(true)

        expectTypeStrictlyEquals<
            Merged<{ readonly foo: Date } & { readonly foo: ReadonlyDate }>,
            { readonly foo: Date }
        >(true)
    })

    it('retains optionality', () => {
        expectTypeStrictlyEquals<
            Merged<{
                test?: number
            }>,
            {
                test?: number
            }
        >(true)
    })

    it('preserves tuples up to 5 length', () => {
        expectTypeStrictlyEquals<
            Merged<{
                test: [number, string, boolean, object, number]
            }>,
            {
                test: [number, string, boolean, object, number]
            }
        >(true)

        expectTypeStrictlyEquals<
            Merged<
                {
                    readonly foo: [number, string]
                } & {
                    readonly bar: number
                }
            >,
            {
                readonly foo: [number, string]
                readonly bar: number
            }
        >(true)

        expectTypeStrictlyEquals<
            Merged<
                {
                    readonly foo: readonly [number, string]
                } & {
                    readonly bar: number
                }
            >,
            {
                readonly foo: readonly [number, string]
                readonly bar: number
            }
        >(true)
    })

    it('intersects non-array types', () => {
        expectTypeStrictlyEquals<Merged<3 & 4>, 3 & 4>(true)

        interface Bar {
            a: number
            f: () => void
        }

        interface Baz {
            b: string
        }

        expectTypeEquals<Merged<Bar & Baz>, Bar & Baz>(true)
    })
})
