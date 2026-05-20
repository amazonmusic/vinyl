/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    getOrSetProp,
    getPrototypeChain,
    isNonNull,
    isPlainObject,
    ownKeys,
} from '@amazon/vinyl-util'
import { expectTypeEquals } from '@amazon/vinyl-util/browserTestUtil'

describe('getPrototypeChain', () => {
    it('returns an array of the prototype chain', () => {
        class A {}
        class B extends A {}
        class C extends B {}
        const c = new C()
        expect(getPrototypeChain(c)).toEqual([
            c,
            C.prototype,
            B.prototype,
            A.prototype,
            Object.prototype,
        ])
    })
})

describe('ownKeys', () => {
    describe('when object is falsy', () => {
        it('returns an empty set', () => {
            expect(ownKeys(null)).toEqual(new Set([]))
            expect(ownKeys(undefined)).toEqual(new Set([]))
        })
    })

    it('returns all own property names and symbols', () => {
        const s1 = Symbol()
        class A {
            readonly a = 1
            readonly [s1] = 2
            readonly [0] = 3
        }

        const c = new A()
        expect(ownKeys(c)).toEqual(new Set(['0', 'a', s1]))
    })

    describe('when an object is an array', () => {
        it('returns indices', () => {
            expect(ownKeys(['a', 'b', 'c'])).toEqual(
                new Set(['0', '1', '2', 'length'])
            )
        })
    })

    describe('when object is not a plain object', () => {
        it('does not return "constructor" as a key', () => {
            class Foo {
                bar = 3
                constructor() {}
            }
            expect(ownKeys(new Foo())).toEqual(new Set(['bar']))
        })
    })

    describe('when Reflect is not supported', () => {
        const prevReflect = global.Reflect
        beforeEach(() => {
            global.Reflect = undefined as any
        })
        afterEach(() => {
            global.Reflect = prevReflect
        })

        // noinspection DuplicatedCode
        it('returns all own property names and symbols', () => {
            const s1 = Symbol()
            class A {
                readonly a = 1
                readonly [s1] = 2
                readonly [0] = 3
            }

            const c = new A()
            expect(ownKeys(c)).toEqual(new Set(['0', 'a', s1]))
        })

        describe('when an object is an array', () => {
            it('returns indices', () => {
                expect(ownKeys(['a', 'b', 'c'])).toEqual(
                    new Set(['0', '1', '2', 'length'])
                )
            })
        })

        describe('when object is not a plain object', () => {
            it('does not return "constructor" as a key', () => {
                class Foo {
                    bar = 3
                    constructor() {}
                }
                expect(ownKeys(new Foo())).toEqual(new Set(['bar']))
            })
        })
    })
})

describe('isPlainObject', () => {
    it('returns false for an array', () => {
        expect(isPlainObject([])).toBeFalse()
        expect(isPlainObject(Array.prototype)).toBeFalse()
    })

    it('returns false for a prototyped object', () => {
        expect(isPlainObject(/a/)).toBeFalse()
        class MyClass {}
        expect(isPlainObject(new MyClass())).toBeFalse()
    })

    it('returns false for non-objects', () => {
        expect(isPlainObject(null)).toBeFalse()
        expect(isPlainObject(void 0)).toBeFalse()
        expect(isPlainObject('')).toBeFalse()
        expect(isPlainObject(Error)).toBeFalse()
    })

    it('returns true for a plain object', () => {
        expect(isPlainObject({})).toBeTrue()
        expect(isPlainObject({ a: 1 })).toBeTrue()
        expect(isPlainObject(Object.create(null))).toBeTrue()
    })
})

describe('getOrSetProp', () => {
    it('gets an object property or sets a new value if defined', () => {
        const o: any = {}
        expect(getOrSetProp(o, 'a', () => 1)).toBe(1)
        expect(getOrSetProp(o, 'a', () => 2)).toBe(1)
        expect(getOrSetProp(o, 'b', () => 2)).toBe(2)
        expect(getOrSetProp(o, 'b', () => 3)).toBe(2)
        o.c = null
        expect(getOrSetProp(o, 'c', () => 3)).toBeNull()
        o.d = undefined
        expect(getOrSetProp(o, 'd', () => 3)).toBeUndefined()
    })
})

describe('isNonNull', () => {
    it('returns true if not nullish', () => {
        expect(isNonNull(null)).toBeFalse()
        expect(isNonNull(0)).toBeTrue()
        expect(isNonNull(undefined)).toBeFalse()
    })

    it('provides a type guard', () => {
        const _arr = [1, null, 2, 3, null, 4].filter(isNonNull)
        expectTypeEquals<number[], typeof _arr>(true)
    })
})
