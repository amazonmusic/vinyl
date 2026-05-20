/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TypedArray } from '@/util/collection/typedArray'
import { isTypedArray } from '@/util/collection/typedArray'
import { isPlainObject, ownKeys } from './object'

/**
 * Recursively compares the values of all the enumerable own properties from two source objects.
 *
 * @param objectA
 * @param objectB
 * @param options
 */
export function equalDeep<T>(
    objectA: T,
    objectB: T,
    options: EqualOptions = defaultEqualOptions
): boolean {
    if (objectA === objectB) return true
    if (objectA == null || objectB == null) return false
    const callback: EqualCallback = (subA, subB) =>
        equalDeep(subA, subB, options)
    for (const rule of options.rules) {
        if (rule.matches(objectA)) {
            if (!rule.matches(objectB)) return false
            return rule.equal(objectA, objectB, callback)
        }
    }
    return false
}

/**
 * Configuration for the equalDeep comparator.
 */
export interface EqualOptions {
    /**
     * The first equal rule where the first source object matches will be used.
     * If the second object does not match, the two objects will not be considered equal.
     */
    readonly rules: readonly EqualRule<any>[]
}

/**
 * A equal function to be provided to equal rules.
 */
export type EqualCallback<T = any> = (objectA: T, objectB: T) => boolean

export interface EqualRule<T> {
    /**
     * Returns true if this EqualRule should be applied for the given object.
     * @param object
     */
    readonly matches: (object: any) => object is T

    /**
     * Equals the two sources.
     * @param objectA May be undefined, the first object to equal.
     * @param objectB The second object to equal or clone if objectA is undefined.
     * @param equal This callback may be used to equal or clone sub-properties.
     */
    readonly equal: (objectA: T, objectB: T, equal: EqualCallback) => boolean
}

export const arrayEqualRule: EqualRule<any[]> = {
    matches(object: any): object is any[] {
        return Array.isArray(object)
    },

    equal(objectA: any[], objectB: any[], equal: EqualCallback): boolean {
        if (objectA.length !== objectB.length) return false
        for (let i = 0; i < objectA.length; i++) {
            if (!equal(objectA[i], objectB[i])) return false
        }
        return true
    },
} as const

export const plainObjectEqualRule: EqualRule<Record<any, any>> = {
    matches(object: any): object is Record<any, any> {
        return isPlainObject(object)
    },

    equal(
        objectA: Record<any, any>,
        objectB: Record<any, any>,
        equal: EqualCallback
    ): boolean {
        const keysA = ownKeys(objectA)
        const keysB = ownKeys(objectB)
        if (keysA.size !== keysB.size) return false
        for (const key of keysA) {
            if (!(key in objectB)) return false
            if (!equal(objectA[key], objectB[key])) return false
        }
        return true
    },
} as const

export const regexpEqualRule: EqualRule<RegExp> = {
    matches(object: any): object is RegExp {
        return object instanceof RegExp
    },
    equal(objectA: RegExp, objectB: RegExp, _: EqualCallback): boolean {
        return (
            // Note: legacy edge does not support flags property
            objectA.toString() === objectB.toString() &&
            objectA.lastIndex === objectB.lastIndex
        )
    },
} as const

export const dateEqualRule: EqualRule<Date> = {
    matches(object: any): object is Date {
        return object instanceof Date
    },
    equal(objectA: Date, objectB: Date, _: EqualCallback): boolean {
        return objectA.getTime() === objectB.getTime()
    },
} as const

export const mapEqualRule: EqualRule<Map<any, any>> = {
    matches(object: any): object is Map<any, any> {
        return object instanceof Map
    },
    equal(
        objectA: Map<any, any>,
        objectB: Map<any, any>,
        equal: EqualCallback
    ): boolean {
        if (objectA.size !== objectB.size) return false
        for (const key of objectA.keys()) {
            if (!objectB.has(key)) return false
            if (!equal(objectA.get(key), objectB.get(key))) return false
        }
        return true
    },
} as const

export const setEqualRule: EqualRule<Set<any>> = {
    matches(object: any): object is Set<any> {
        return object instanceof Set
    },
    equal(objectA: Set<any>, objectB: Set<any>, _: EqualCallback): boolean {
        if (objectA.size !== objectB.size) return false
        for (const key of objectA.keys()) {
            if (!objectB.has(key)) return false
        }
        return true
    },
} as const

/**
 * A typed array will always have primitive elements, compare that the lengths are equal and every
 * element is equal.
 */
export const typedArrayEqualRule: EqualRule<TypedArray> = {
    matches(object: any): object is TypedArray {
        return isTypedArray(object)
    },
    equal(objectA: TypedArray, objectB: TypedArray, _: EqualCallback): boolean {
        if (objectA.length !== objectB.length) return false
        if (objectA.byteLength !== objectB.byteLength) return false
        for (let i = 0; i < objectA.length; i++) {
            if (objectA[i] !== objectB[i]) return false
        }
        return true
    },
} as const

/**
 * The default equal options provide rules for comparing arrays, plain objects, RegExp, Date,
 * Map, Set, and TypedArray.
 */
export const defaultEqualOptions: EqualOptions = {
    rules: [
        arrayEqualRule,
        plainObjectEqualRule,
        regexpEqualRule,
        dateEqualRule,
        mapEqualRule,
        setEqualRule,
        typedArrayEqualRule,
    ],
} as const
