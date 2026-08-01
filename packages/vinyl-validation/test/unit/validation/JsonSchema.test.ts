/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    any,
    array,
    boolean,
    createValidator,
    enumOf,
    exactlyNull,
    exactlyUndefined,
    func,
    isOneOf,
    type JsonSchema,
    mergeJsonSchema,
    number,
    nullish,
    object,
    record,
    recordValues,
    set,
    string,
    symbol,
    toJsonSchema,
    tuple,
} from '@amazon/vinyl-validation'

describe('JsonSchema', () => {
    describe('mergeJsonSchema', () => {
        it('ignores undefined fragments', () => {
            expect(mergeJsonSchema(undefined, { type: 'string' })).toEqual({
                type: 'string',
            })
        })

        it('ignores keys whose value is undefined', () => {
            // Explicit undefined keys can arrive at runtime even though the type forbids them.
            const withUndefined = {
                type: 'string',
                minLength: undefined,
            } as unknown as JsonSchema
            expect(mergeJsonSchema(withUndefined)).toEqual({ type: 'string' })
        })

        it('combines properties from each fragment', () => {
            expect(
                mergeJsonSchema(
                    { type: 'object', properties: { a: { type: 'string' } } },
                    { properties: { b: { type: 'number' } } }
                )
            ).toEqual({
                type: 'object',
                properties: {
                    a: { type: 'string' },
                    b: { type: 'number' },
                },
            })
        })

        it('unions required keys without duplicates', () => {
            expect(
                mergeJsonSchema(
                    { required: ['a', 'b'] },
                    { required: ['b', 'c'] }
                )
            ).toEqual({ required: ['a', 'b', 'c'] })
        })

        it('lets later fragments override scalar keywords', () => {
            expect(mergeJsonSchema({ minLength: 1 }, { minLength: 5 })).toEqual(
                { minLength: 5 }
            )
        })
    })

    describe('toJsonSchema', () => {
        it('serializes a plain validator from its attached fragment', () => {
            const validator = createValidator('even', () => true, undefined, {
                type: 'integer',
            })
            expect(toJsonSchema(validator)).toEqual({ type: 'integer' })
        })

        it('returns an empty schema for a validator with no fragment', () => {
            const validator = createValidator('anything', () => true)
            expect(toJsonSchema(validator)).toEqual({})
        })

        it('delegates to a schema node that provides its own definition', () => {
            expect(toJsonSchema(string())).toEqual({ type: 'string' })
        })
    })

    describe('primitive nodes', () => {
        it('serializes strings with their constraints', () => {
            expect(
                toJsonSchema(
                    string()
                        .notEmpty()
                        .minLength(3)
                        .maxLength(10)
                        .matches(/^[a-z]+$/)
                )
            ).toEqual({
                type: 'string',
                minLength: 3,
                maxLength: 10,
                pattern: '^[a-z]+$',
            })
        })

        it('serializes numbers with their bounds', () => {
            expect(toJsonSchema(number().gte(0).lte(100))).toEqual({
                type: 'number',
                minimum: 0,
                maximum: 100,
            })
        })

        it('serializes exclusive number bounds', () => {
            expect(toJsonSchema(number().gt(0).lt(100))).toEqual({
                type: 'number',
                exclusiveMinimum: 0,
                exclusiveMaximum: 100,
            })
        })

        it('serializes within as inclusive bounds', () => {
            expect(toJsonSchema(number().within(1, 9))).toEqual({
                type: 'number',
                minimum: 1,
                maximum: 9,
            })
        })

        it('serializes safe integers as the integer type', () => {
            expect(toJsonSchema(number().safeInteger())).toEqual({
                type: 'integer',
            })
        })

        it('serializes booleans', () => {
            expect(toJsonSchema(boolean())).toEqual({ type: 'boolean' })
        })
    })

    describe('value nodes without a JSON representation', () => {
        it('serializes any to the empty schema', () => {
            expect(toJsonSchema(any())).toEqual({})
        })

        it('serializes symbol to the empty schema', () => {
            expect(toJsonSchema(symbol())).toEqual({})
        })

        it('serializes func to the empty schema', () => {
            expect(toJsonSchema(func())).toEqual({})
        })

        it('serializes strict undefined to the empty schema', () => {
            expect(toJsonSchema(exactlyUndefined())).toEqual({})
        })
    })

    describe('null nodes', () => {
        it('serializes strict null', () => {
            expect(toJsonSchema(exactlyNull())).toEqual({ type: 'null' })
        })

        it('serializes nullish as null only', () => {
            expect(toJsonSchema(nullish())).toEqual({ type: 'null' })
        })
    })

    describe('enum nodes', () => {
        it('serializes isOneOf as an enum', () => {
            expect(toJsonSchema(isOneOf('a', 'b', 'c'))).toEqual({
                enum: ['a', 'b', 'c'],
            })
        })

        it('serializes enumOf as an enum of the enum values', () => {
            enum Color {
                Red = 'red',
                Green = 'green',
            }
            expect(toJsonSchema(enumOf(Color))).toEqual({
                enum: ['red', 'green'],
            })
        })
    })

    describe('array nodes', () => {
        it('serializes an array of a single element type with length bounds', () => {
            expect(
                toJsonSchema(array(string()).minLength(1).maxLength(4))
            ).toEqual({
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                maxItems: 4,
            })
        })

        it('serializes a bare array without an item schema', () => {
            expect(toJsonSchema(array())).toEqual({ type: 'array' })
        })

        it('serializes a tuple positionally', () => {
            expect(toJsonSchema(tuple(string(), number()))).toEqual({
                type: 'array',
                items: [{ type: 'string' }, { type: 'number' }],
                minItems: 2,
                maxItems: 2,
                additionalItems: false,
            })
        })
    })

    describe('set nodes', () => {
        it('serializes a set as a unique-item array', () => {
            expect(toJsonSchema(set(number()))).toEqual({
                type: 'array',
                uniqueItems: true,
                items: { type: 'number' },
            })
        })
    })

    describe('record nodes', () => {
        it('serializes a record as an object with typed additional properties', () => {
            expect(toJsonSchema(record(string(), number()))).toEqual({
                type: 'object',
                additionalProperties: { type: 'number' },
            })
        })

        it('serializes recordValues the same way', () => {
            expect(toJsonSchema(recordValues(string()))).toEqual({
                type: 'object',
                additionalProperties: { type: 'string' },
            })
        })
    })

    describe('object nodes', () => {
        it('serializes properties, marking required versus optional', () => {
            const schema = object({
                name: string(),
                age: number().optional(),
            })
            expect(toJsonSchema(schema)).toEqual({
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                },
                required: ['name'],
            })
        })

        it('omits required when every property is optional', () => {
            const schema = object({
                a: string().optional(),
                b: number().optional(),
            })
            expect(toJsonSchema(schema)).toEqual({
                type: 'object',
                properties: {
                    a: { type: 'string' },
                    b: { type: 'number' },
                },
            })
        })

        it('serializes nested objects and arrays', () => {
            interface Nested {
                user: {
                    id: string
                    scores: number[]
                }
            }
            const schema = object<Nested>({
                user: object({
                    id: string(),
                    scores: array(number()),
                }),
            })
            expect(toJsonSchema(schema)).toEqual({
                type: 'object',
                properties: {
                    user: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            scores: {
                                type: 'array',
                                items: { type: 'number' },
                            },
                        },
                        required: ['id', 'scores'],
                    },
                },
                required: ['user'],
            })
        })

        it('merges properties and unions required keys when extended', () => {
            interface Base {
                a: string
            }
            interface Extended extends Base {
                b: number
            }
            const schema = object<Base>({ a: string() }).extend<Extended>({
                b: number(),
            })
            expect(toJsonSchema(schema)).toEqual({
                type: 'object',
                properties: {
                    a: { type: 'string' },
                    b: { type: 'number' },
                },
                required: ['a', 'b'],
            })
        })
    })

    describe('union nodes', () => {
        it('serializes or as an anyOf of each branch', () => {
            expect(toJsonSchema(string().or(number()))).toEqual({
                anyOf: [{ type: 'string' }, { type: 'number' }],
            })
        })

        it('serializes maybe as a union with null', () => {
            expect(toJsonSchema(string().maybe())).toEqual({
                anyOf: [{ type: 'string' }, { type: 'null' }],
            })
        })

        it('collapses a union to a single branch when others have no representation', () => {
            expect(toJsonSchema(string().orUndefined())).toEqual({
                type: 'string',
            })
        })
    })

    describe('describe', () => {
        it('attaches a description without affecting validation', () => {
            const described = string().notEmpty().describe('a non-empty label')
            expect(described.isValid('hello')).toBeTrue()
            expect(described.isValid('')).toBeFalse()
            expect(toJsonSchema(described)).toEqual({
                type: 'string',
                minLength: 1,
                description: 'a non-empty label',
            })
        })

        it('describes an object property', () => {
            const schema = object({
                id: string().describe('The unique id'),
            })
            expect(toJsonSchema(schema)).toEqual({
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'The unique id' },
                },
                required: ['id'],
            })
        })
    })
})
