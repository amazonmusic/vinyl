/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Json, toJson } from '@amazon/vinyl-util'
import { expectNothing } from '@amazon/vinyl-util/browserTestUtil'
import any = jasmine.any

describe('toJson', () => {
    it('returns the toJSON() value if it is an object with a toJSON method', () => {
        const o = {
            toJSON(): Json {
                return 1
            },
        } as const
        expect(toJson(o)).toEqual(1)
    })

    it('returns the toJSON return value if it is an error with a toJSON method', () => {
        class SerializableError extends Error {
            toJSON(): Json {
                return 1
            }
        }
        expect(toJson(new SerializableError())).toEqual(1)
    })

    it('returns the value if it is serializable', () => {
        expect(toJson(1)).toEqual(1)
        expect(toJson(0)).toEqual(0)
        expect(toJson(NaN)).toEqual(NaN)
        expect(toJson('a')).toEqual('a')
        expect(toJson(null)).toEqual(null)
        expect(toJson(true)).toEqual(true)
        expect(toJson(new Date('1971-01-10T11:41:04.100Z'))).toEqual(
            '1971-01-10T11:41:04.100Z'
        )
        // Function, undefined, and Symbol are not valid JSON values, they are omitted if
        // properties in an object, or null if array elements.
        // toJson keeps these values as is, JSON.stringify may be given a replacer.
        expect(toJson(undefined)).toEqual(undefined)
        const s = Symbol('test')
        expect(toJson(s)).toBe('[symbol test]')
        const f = () => {}
        expect(typeof toJson(f)).toBe('string') // [function f] for debug environments, obfuscated for release
        expect(toJson(f)).toContain('[function')
    })

    it('returns a plain object if it is a non-serializable Error', () => {
        expect(toJson(new Error('test'))).toEqual({
            message: 'test',
            name: 'Error',
            stack: any(String),
        })
    })

    it('returns the reason if it is non-serializable and not an error', () => {
        const o = { test: 3 }
        expect(toJson(o)).toEqual(o)
    })

    it('uses toString for bigint', () => {
        if (typeof BigInt !== 'undefined') {
            const v = BigInt('123')
            expect(toJson(v)).toBe(v.toString())
        } else {
            expectNothing()
        }
    })

    it('avoids traversing circular references', () => {
        const b = {
            [Symbol.toStringTag]: 'B',
            c: { b: null as any },
        }
        b.c.b = b
        expect<any>(toJson(b)).toEqual({
            c: { b: '<circular reference: [object B]>' },
        })
    })

    it('processes enumerable properties for plain objects', () => {
        class NotPlainObject {
            get [Symbol.toStringTag](): string {
                return 'NotPlainObject'
            }
            readonly name = 'NotPlainObject'
            readonly value = 3
            constructor() {}
        }

        expect<any>(
            toJson({
                a: new Date('2023-04-19T05:12:16.881Z'),
                b: {
                    c: 3,
                    d: {
                        toJSON(): Json {
                            return 'a'
                        },
                    },
                    e: new NotPlainObject(),
                },
            })
        ).toEqual({
            a: '2023-04-19T05:12:16.881Z',
            b: {
                c: 3,
                d: 'a',
                e: '[object NotPlainObject]',
            },
        })
    })

    it('handles Set objects', () => {
        const set = new Set([1, 2, 3])
        expect(toJson(set)).toEqual([1, 2, 3])
    })

    it('handles Set elements', () => {
        const set = new Set([
            Symbol('test'),
            new Date('2023-01-01T00:00:00.000Z'),
            { a: 1 },
        ])
        expect(toJson(set)).toEqual([
            '[symbol test]',
            '2023-01-01T00:00:00.000Z',
            { a: 1 },
        ])
    })
})
