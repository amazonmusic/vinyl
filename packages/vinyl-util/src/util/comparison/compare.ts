/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Maybe, Primitive } from '@/util/type'

/**
 * A function that can be used as a comparator for sorting.
 * Return > 0 if `a` is greater than `b`
 * Return = 0 if `a` equals `b`
 * Return < 0 if `a` is less than `b
 */
export type Comparator<A, B = A> = (a: A, b: B) => number

/**
 * Provides a primitive value plucked from an element. Used in {@link compareBy} for building a comparator.
 */
export type CompareBySelector<T> = (value: T) => Exclude<Primitive, symbol>

/**
 * Creates a comparator for objects of type T by using a selector to pick a primitive value.
 *
 * @param selectors
 */
export function compareBy<T>(
    ...selectors: CompareBySelector<T>[]
): Comparator<Maybe<T>> {
    return (a: Maybe<T>, b: Maybe<T>): number => {
        if (a == null && b == null) return 0
        if (a == null) return -1
        if (b == null) return 1
        for (const selector of selectors) {
            const comparison = compare(selector(a), selector(b))
            if (comparison !== 0) return comparison
        }
        return 0
    }
}

/**
 * Reverses the order of a comparator.
 *
 * @param comparator
 */
export function reversed<A, B>(comparator: Comparator<A, B>): Comparator<A, B> {
    return (a: A, b: B): number => -comparator(a, b)
}

/**
 * Compares two primitive values.
 *
 * Return 1 if `a` is greater than `b`
 * Return 0 if `a` equals `b`
 * Return -1 if `a` is less than `b
 */
export function compare<T extends Exclude<Primitive, symbol>>(
    a: T | null,
    b: T | null
): number {
    if (a == null && b == null) return 0
    if (a == null) return -1
    if (b == null) return 1
    if (a > b) return 1
    if (a < b) return -1
    return 0
}
