/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IllegalArgumentError } from '@/error/IllegalArgumentError'
import type { TypedArray } from '@/util/collection/typedArray'
import { cloneTypedArray, isTypedArray } from '@/util/collection/typedArray'
import { union } from '@/util/set/set'
import { substitute } from '@/util/string/string'
import { ownKeys, isPlainObject } from './object'
import { ReportableError } from '@/error/ReportableError'
import { type Cloneable, isCloneable } from '@/core/cloneable'

const locale = {
    cyclicRefError: 'Cyclic reference found at: {path}',
    mergeReferenceError: `No merge rule found at {path} for "{source}" and reference copy not allowed`,
} as const

/**
 * Concatenates multiple arrays together where each element is deeply cloned.
 */
export function mergeDeep<T extends Array<any>>(
    sources: readonly T[],
    options?: Partial<MergeOptions>
): T

/**
 * Deep clones the given object.
 */
export function mergeDeep<T>(
    sources: readonly [T],
    options?: Partial<MergeOptions>
): T

/**
 * Deep merges the two objects.
 * If common keys are both arrays, they will be concatenated, if common keys are both objects, they
 * will be merged. Incompatible types, e.g. an object and an array will use the later source.
 */
export function mergeDeep<A, B>(
    sources: readonly [A, B],
    options?: Partial<MergeOptions>
): A & B

/**
 * Deep merges the three objects.
 * If common keys are both arrays, they will be concatenated, if common keys are both objects, they
 * will be merged. Incompatible types, e.g. an object and an array will use the later source.
 */
export function mergeDeep<A, B, C>(
    sources: readonly [A, B, C],
    options?: Partial<MergeOptions>
): A & B & C

/**
 * Deep merges the four objects.
 * If common keys are both arrays, they will be concatenated, if common keys are both objects, they
 * will be merged. Incompatible types, e.g. an object and an array will use the later source.
 */
export function mergeDeep<A, B, C, D>(
    sources: readonly [A, B, C, D],
    options?: Partial<MergeOptions>
): A & B & C & D

/**
 * Deep merges the five objects.
 * If common keys are both arrays, they will be concatenated, if common keys are both objects, they
 * will be merged. Incompatible types, e.g. an object and an array will use the later source.
 */
export function mergeDeep<A, B, C, D, E>(
    sources: readonly [A, B, C, D, E],
    options?: Partial<MergeOptions>
): A & B & C & D & E

/**
 * Deep merges the six objects.
 * If common keys are both arrays, they will be concatenated, if common keys are both objects, they
 * will be merged. Incompatible types, e.g. an object and an array will use the later source.
 */
export function mergeDeep<A, B, C, D, E, F>(
    sources: readonly [A, B, C, D, E, F],
    options?: Partial<MergeOptions>
): A & B & C & D & E & F

/**
 * Deep merges all objects.
 * If common keys are both arrays, they will be concatenated, if common keys are both objects, they
 * will be merged. Incompatible types, e.g. an object and an array will use the later source.
 */
export function mergeDeep(
    sources: readonly any[],
    options?: Partial<MergeOptions>
): any

/**
 * Recursively copies the values of all the enumerable own properties from one or two source
 * objects to a new object.
 * Arrays will be concatenated.
 *
 * @param sources One or more source objects from which to copy properties. A single source
 * provided will return a deep clone. Incompatible objects, for example given a number and an
 * array, will return a clone of the last argument.
 * @param options
 * @see merge
 */
export function mergeDeep(
    sources: readonly any[],
    options?: Partial<MergeOptions>
): any {
    if (!sources.length) return undefined
    const finalOpts: MergeOptions = {
        ...defaultMergeOptions,
        ...options,
    }
    const stack = new PropStack()
    const n = sources.length

    if (n === 1)
        // Clone the single element.
        return _mergeDeep(undefined, sources[0], stack, 0, finalOpts)
    // Initial accumulator:
    let out = _mergeDeep(sources[0], sources[1], stack, 1, finalOpts)
    for (let i = 2; i < n; i++) {
        out = _mergeDeep(out, sources[i], stack, i, finalOpts)
    }
    return out
}

/**
 * Merge options defines the behavior for {@link mergeDeep}.
 * See the {@link defaultMergeOptions} for defaults that will be used if any merge options are
 * omitted.
 */
export interface MergeOptions {
    /**
     * If an object does not pass any of the rules, if this is true (default) the reference will be
     * copied. If false, a {@link MergeReferenceError} will be thrown.
     * This only applies to objects, not functions or primitives.
     */
    readonly allowReferenceCopy: boolean

    /**
     * The first merge rule where the second source object matches will be used.
     * Rules are only checked for values that have a typeof value of 'object'
     * If the first object does not pass the match, undefined will be passed to sourceA and the
     * rule is expected to return a clone of sourceB.
     * If no rules match, the value will be copied by reference unless `allowReferenceCopy` is
     * false, in which case, a {@link MergeReferenceError} will be thrown.
     */
    readonly rules: readonly MergeRule<any>[]
}

/**
 * A merge function to be provided to merge rules.
 */
export type MergeCallback<T = any> = (
    /**
     * The first like object to merge, or undefined. If undefined is provided, a
     * clone of sourceB is expected to be returned. If defined, this object is guaranteed to have
     * passed {@link MergeRule.matches}
     */
    sourceA: T | undefined,

    /**
     * The second object to merge or clone.
     */
    sourceB: T,

    /**
     * The identifier to be used in error reporting.
     */
    prop: string | number
) => T

export interface MergeRule<T> {
    /**
     * Returns true if this MergeRule should be applied for the given object.
     * @param object
     */
    readonly matches: (object: any) => object is T

    /**
     * Merges the two sources.
     * @param sourceA May be undefined, the first object to merge.
     * @param sourceB The second object to merge or clone if sourceA is undefined.
     * @param merge This callback may be used to merge or clone sub-properties.
     */
    readonly merge: (
        sourceA: T | undefined,
        sourceB: T,
        merge: MergeCallback
    ) => T
}

/**
 * A stack of the current property recursion.
 * PropStack has two purposes, it provides the current property path in the node traversal and
 * ensures that nodes do not cyclically reference themselves.
 */
class PropStack {
    /**
     * Object references for sourceA.
     */
    private refsA = new Set<any>()

    /**
     * Object references for sourceB.
     */
    private refsB = new Set<any>()
    private propStack: [any, any, keyof any | undefined][] = []

    /**
     * The property stack, joined by .
     */
    get currentPath(): string {
        return this.propStack
            .map((e) => e[2])
            .filter((e) => e != null)
            .join('.')
    }

    push(sourceA: any, sourceB: any, prop?: keyof any) {
        this.propStack.push([sourceA, sourceB, prop])
        this.addRef(this.refsA, sourceA)
        this.addRef(this.refsB, sourceB)
    }

    pop() {
        const last = this.propStack.pop()!
        this.refsA.delete(last[0])
        this.refsB.delete(last[1])
    }

    private addRef(refSet: Set<any>, source: any) {
        if (typeof source !== 'object') return
        if (refSet.has(source)) {
            throw new IllegalArgumentError(
                substitute(locale.cyclicRefError, { path: this.currentPath })
            )
        }
        refSet.add(source)
    }
}

function _mergeDeep<T>(
    sourceA: T | undefined,
    sourceB: T,
    propStack: PropStack,
    prop: keyof any | undefined,
    options: MergeOptions
): T {
    if (typeof sourceB !== 'object' || sourceB === null) return sourceB

    const merge: MergeCallback = (sourceA, sourceB, prop) => {
        return _mergeDeep(sourceA, sourceB, propStack, prop, options)
    }
    for (const rule of options.rules) {
        if (rule.matches(sourceB)) {
            propStack.push(sourceA, sourceB, prop)
            const result = rule.merge(
                rule.matches(sourceA) ? sourceA : undefined,
                sourceB,
                merge
            )
            propStack.pop()
            return result
        }
    }
    if (!options.allowReferenceCopy) {
        // push before throwing to get the full currentPath:
        propStack.push(sourceA, sourceB, prop)
        throw new MergeReferenceError(propStack.currentPath, sourceB)
    }
    return sourceB
}

export class MergeReferenceError extends ReportableError {
    constructor(propPath: string, source: any) {
        super(
            substitute(locale.mergeReferenceError, {
                path: propPath,
                source,
            })
        )
        Object.setPrototypeOf(this, MergeReferenceError.prototype)
    }
}

/**
 * Cloneable objects are not expected to be mergeable, but should be cloned.
 */
export const cloneableMergeRule: MergeRule<Cloneable<any>> = {
    matches(object: any): object is Cloneable<any> {
        return isCloneable(object)
    },

    merge(
        _1: Cloneable<any> | undefined,
        sourceB: Cloneable<any>,
        _2: MergeCallback
    ): Cloneable<any> {
        return sourceB.clone()
    },
}

export const arrayMergeRule: MergeRule<any[]> = {
    matches(object: any): object is any[] {
        return Array.isArray(object)
    },

    merge(
        sourceA: any[] | undefined,
        sourceB: any[],
        merge: MergeCallback
    ): any[] {
        const out = []
        if (sourceA) {
            for (const element of sourceA) {
                out.push(merge(undefined, element, out.length))
            }
        }
        for (const element of sourceB) {
            out.push(merge(undefined, element, out.length))
        }
        return out
    },
} as const

export const plainObjectMergeRule: MergeRule<Record<any, any>> = {
    matches(object: any): object is Record<any, any> {
        return isPlainObject(object)
    },

    merge(
        sourceA: Record<any, any> | undefined,
        sourceB: Record<any, any>,
        merge: MergeCallback
    ): Record<any, any> {
        const out: any = {}
        // Iterate over the unique set of the union of keys between the two objects.
        for (const key of union(ownKeys(sourceA), ownKeys(sourceB))) {
            if (sourceA && key in sourceB && key in sourceA) {
                out[key] = merge(sourceA[key], sourceB[key], key)
            } else if (sourceA && key in sourceA) {
                out[key] = merge(undefined, sourceA[key], key)
            } else {
                out[key] = merge(undefined, sourceB[key], key)
            }
        }
        return out
    },
} as const

export const regexpMergeRule: MergeRule<RegExp> = {
    matches(object: any): object is RegExp {
        return object instanceof RegExp
    },
    merge(_1: RegExp | undefined, sourceB: RegExp, _2: MergeCallback): RegExp {
        // Clone the regex; they are stateful.
        return new RegExp(sourceB.source, sourceB.flags)
    },
} as const

export const dateMergeRule: MergeRule<Date> = {
    matches(object: any): object is Date {
        return object instanceof Date
    },
    merge(_1: Date | undefined, sourceB: Date, _2: MergeCallback): Date {
        return new Date(sourceB.getTime())
    },
} as const

export const mapMergeRule: MergeRule<Map<any, any>> = {
    matches(object: any): object is Map<any, any> {
        return object instanceof Map
    },
    merge(
        sourceA: Map<any, any> | undefined,
        sourceB: Map<any, any>,
        merge: MergeCallback
    ): Map<any, any> {
        const out = new Map()
        // Iterate over the unique set of the union of keys between the two objects.
        for (const key of new Set([
            ...(sourceA?.keys() ?? []),
            ...sourceB.keys(),
        ])) {
            if (sourceB.has(key) && sourceA?.has(key)) {
                out.set(key, merge(sourceA.get(key), sourceB.get(key), key))
            } else if (sourceA?.has(key)) {
                out.set(key, merge(undefined, sourceA.get(key), key))
            } else {
                out.set(key, merge(undefined, sourceB.get(key), key))
            }
        }
        return out
    },
} as const

export const setMergeRule: MergeRule<Set<any>> = {
    matches(object: any): object is Set<any> {
        return object instanceof Set
    },
    merge(
        sourceA: Set<any> | undefined,
        sourceB: Set<any>,
        merge: MergeCallback
    ): Set<any> {
        return new Set(
            [...(sourceA?.values() ?? []), ...sourceB.values()].map(
                (element, index) => {
                    return merge(undefined, element, index)
                }
            )
        )
    },
} as const

/**
 * Typed arrays will not concatenate by default like arrays. Typed arrays generally represent data,
 * not configuration, and the more reasonable default is to clone, not concatenate.
 */
export const typedArrayMergeRule: MergeRule<TypedArray> = {
    matches(object: any): object is TypedArray {
        return isTypedArray(object)
    },
    merge(
        _1: TypedArray | undefined,
        sourceB: TypedArray,
        _2: MergeCallback
    ): TypedArray {
        return cloneTypedArray(sourceB)
    },
} as const

export const urlMergeRule: MergeRule<URL> = {
    matches(object: any): object is URL {
        return object instanceof URL
    },
    merge(_1: URL | undefined, sourceB: URL, _2: MergeCallback): URL {
        return new URL(sourceB.toString())
    },
} as const

/**
 * The default merge options provide rules for merging arrays, plain objects, RegExp, Date,
 * Map, Set, and TypedArray.
 */
export const defaultMergeOptions: MergeOptions = {
    allowReferenceCopy: true,
    rules: [
        cloneableMergeRule,
        arrayMergeRule,
        plainObjectMergeRule,
        regexpMergeRule,
        dateMergeRule,
        mapMergeRule,
        setMergeRule,
        typedArrayMergeRule,
        urlMergeRule,
    ],
} as const
