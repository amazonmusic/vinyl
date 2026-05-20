/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    array,
    custom,
    isOneOf,
    number,
    object,
    type ObjectSchema,
    objectValidators,
    string,
    type Validator,
    type ValueSchema,
} from '@amazon/vinyl-validation'
import {
    expectNothing,
    expectTypeStrictlyEquals,
} from '@amazon/vinyl-util/browserTestUtil'
import { type PartialDeep, ValidationError } from '@amazon/vinyl-util'
import objectContaining = jasmine.objectContaining

describe('ObjectSchema', () => {
    interface ComplexType {
        a: number
        b: string
        c: number[]
        d: {
            d1: number
            d2: string
            d3: {
                d3a: number
            }
        }
    }

    const complexTypeSchema: ObjectSchema<ComplexType> = object({
        a: number(),
        b: string(),
        c: array(number()),
        d: object({
            d1: number(),
            d2: string(),
            d3: object({
                d3a: number(),
            }),
        }),
    })

    interface T {
        readonly a: number
        readonly b?: string | null
    }

    interface S extends T {
        readonly a: 42
        readonly b: string
    }

    it('validates that the input is a non-nullish object', () => {
        const v: ValueSchema<object> = object({})
        expect(v.isValid({})).toBeTrue()
        expect(v.isValid(3)).toBeFalse()
        expect(v.isValid(null)).toBeFalse()
    })

    it('validates that each property validator matches', () => {
        const v = object({
            a: number(),
            b: string().orNull().optional(),
        })

        expect(v.isValid(null)).toBeFalse()
        expect(v.isValid(undefined)).toBeFalse()
        expect(v.validate(3)).toEqual([
            {
                message: 'Expected: type object, but was: 3. At: ',
                path: [],
            },
        ])
        expect(
            v.isValid({
                a: 3,
            })
        ).toBeTrue()
    })

    it('concatenates the path for nested objects', () => {
        const extend: Validator<{
            b: {
                c: object
            }
        }> = object({
            b: object({
                c: object({}),
            }),
        })
        expect(
            extend.validate({
                b: {},
            })
        ).toEqual([
            objectContaining({
                path: ['b', 'c'],
            }),
        ])
        expect(
            extend.isValid({
                b: {
                    c: {},
                },
            })
        ).toBeTrue()
    })

    it('provides a description of the expected shape', () => {
        const v = objectValidators.properties<object>({
            a: custom('1', (_) => true),
            b: custom('2', (_) => true),
            c: custom('3', (_) => true).optional(),
        })

        expect(v.description).toEqual(`{
  a: 1,
  b: 2,
  c?: 3
}`)
    })

    describe('extend', () => {
        const tValidator: ObjectSchema<T> = object({
            a: number(),
            b: string().orNull().optional(),
        })

        it('narrows the current type', () => {
            const v: ObjectSchema<T & S> = tValidator.extend<S>({
                a: isOneOf(42),
                b: string(),
            })
            expect(v.isValid(null)).toBeFalse()
            expect(v.isValid(undefined)).toBeFalse()

            expect(
                v.isValid({
                    a: 42,
                    b: 'test',
                })
            ).toBeTrue()

            expect(
                v.isValid({
                    a: 42,
                    b: null,
                })
            ).toBeFalse()

            expect(v.validate(3)).toEqual([
                {
                    message: 'Expected: type object, but was: 3. At: ',
                    path: [],
                },
            ])
            expect(v.validate({ a: 3 })).toEqual([
                {
                    message: 'Expected: one of: 42, but was: 3. At: a',
                    path: ['a'],
                },
            ])
        })

        it('requires validators for properties that exist in U but not T', () => {
            tValidator.extend<S>(
                // @ts-expect-error Expected 'b' to be required
                {
                    a: isOneOf(42),
                }
            )
            expectNothing() // Compile-time test
        })

        it('requires validators for properties that have a different shape in U than T', () => {
            tValidator.extend<S>(
                // @ts-expect-error Expected 'a' to be required
                {
                    b: string(),
                }
            )
            tValidator.extend<S>({
                // @ts-expect-error Expected 'a' to validate to type 42
                a: number(),
                b: string(),
            })
            expectNothing() // Compile-time test
        })

        it('allows validators for properties with same shape in U as T to be optional', () => {
            interface U {
                readonly a: number
                readonly b: number
            }
            const uValidator: ObjectSchema<U> = object({
                a: number(),
                b: number(),
            })

            interface V extends U {
                readonly a: number
                readonly c: number
                readonly d?: number
            }

            uValidator.extend<V>({
                c: number(),
                d: number().optional(),
            })
            uValidator.extend<V>({
                a: number(),
                c: number(),
                d: number().optional(),
            })

            uValidator.extend<V>(
                // @ts-expect-error expected a required validator for 'd'
                {
                    a: number(),
                    c: number(),
                }
            )
            uValidator.extend<V>({
                // @ts-expect-error property a cannot be overridden to a different shape
                a: string(),
                c: number(),
            })
            expectNothing() // Compile-time test
        })
    })

    describe('partial', () => {
        it('allows all properties to be undefined', () => {
            const partial: ObjectSchema<Partial<ComplexType>> =
                complexTypeSchema.partial()
            expect(partial.isValid({})).toBeTrue()
            expect(
                partial.isValid({
                    b: 'str',
                    c: [1],
                })
            ).toBeTrue()
            expect(
                partial.isValid({
                    // not deep partial
                    d: {},
                })
            ).toBeFalse()
            expect(
                partial.isValid({
                    a: 'invalid',
                })
            ).toBeFalse()
        })

        it('allows all properties from previous validators to be undefined', () => {
            interface Extended {
                e: string
                f: number
            }

            const partial: ObjectSchema<Partial<ComplexType & Extended>> =
                complexTypeSchema
                    .extend<Extended>({
                        e: string(),
                        f: number(),
                    })
                    .partial()
            expect(partial.isValid({})).toBeTrue()
            expect(
                partial.isValid({
                    e: 'test',
                    f: 3,
                })
            ).toBeTrue()
            expect(
                partial.isValid({
                    e: 3,
                })
            ).toBeFalse()
            expect(
                partial.isValid({
                    b: 'str',
                    c: [1],
                })
            ).toBeTrue()
        })
    })

    describe('partialDeep', () => {
        it('allows all nested properties to be undefined', () => {
            const partialDeep: ObjectSchema<PartialDeep<ComplexType>> =
                complexTypeSchema.partialDeep()
            expect(partialDeep.isValid({})).toBeTrue()
            expect(
                partialDeep.isValid({
                    b: 'str',
                    c: [1],
                })
            ).toBeTrue()
            expect(
                partialDeep.isValid({
                    d: {},
                })
            ).toBeTrue()
            expect(
                partialDeep.isValid({
                    a: 'invalid',
                })
            ).toBeFalse()
        })
    })

    describe('cast', () => {
        it('casts the type parameter', () => {
            const _v = object({}).cast<{ a: 3 }>()
            expectTypeStrictlyEquals<typeof _v, ObjectSchema<{ a: 3 }>>(true)
        })
    })

    describe('optional properties', () => {
        interface WithOptionalMembers {
            a: number
            b?: string
            c?: number
            d: {
                d1?: number
                d2: string
            }
        }

        it('require validators flagged as optional', () => {
            const withOptionalSchema: ObjectSchema<WithOptionalMembers> =
                object({
                    a: number(),
                    b: string().optional(),
                    c: number().optional(),
                    d: object({
                        d1: number().optional(),
                        d2: string(),
                    }),
                })
            // Just testing compile-time shape
            expect(withOptionalSchema).toBeDefined()

            const badSchema1: ObjectSchema<WithOptionalMembers> = object({
                a: number(),
                // @ts-expect-error requires string().optional()
                b: string(),
                c: number().optional(),
                d: object({
                    d1: number().optional(),
                    d2: string(),
                }),
            })
            expect(badSchema1).toBeDefined()

            const badSchema2: ObjectSchema<WithOptionalMembers> = object({
                a: number(),
                b: string().optional(),
                c: number().optional(),
                d: object({
                    // @ts-expect-error Expected number().optional()
                    d1: number(),
                    d2: string(),
                }),
            })
            expect(badSchema2).toBeDefined()
        })

        it('allows optional properties to be missing', () => {
            const withOptionalSchema: ObjectSchema<WithOptionalMembers> =
                object({
                    a: number(),
                    b: string().optional(),
                    c: number().optional(),
                    d: object({
                        d1: number().optional(),
                        d2: string(),
                    }),
                })
            expect(
                withOptionalSchema.isValid({
                    a: 1,
                    d: {
                        d2: 'test',
                    },
                })
            ).toBeTrue()

            expect(
                withOptionalSchema.isValid({
                    a: 1,
                })
            ).toBeFalse()

            expect(
                withOptionalSchema.isValid({
                    a: 1,
                    d: {
                        d1: 1,
                    },
                })
            ).toBeFalse()

            expect(() =>
                withOptionalSchema.assert({
                    a: 1,
                    d: {
                        d1: 1,
                    },
                })
            ).toThrowError(ValidationError, /property 'd2' is required/)
        })
    })
})
