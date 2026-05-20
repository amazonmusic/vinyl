/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IllegalArgumentError } from '@/error/IllegalArgumentError'

/**
 * Returns an array of numbers between start and end, incrementing by step.
 *
 * E.g.
 * ```
 * range(1, 10) // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
 * range(5, 2) // [5, 4, 3, 2]
 * range(5, 4, -0.2) // [5.0, 4.8, 4.6, 4.4, 4.2, 4.0]
 * ```
 * @param start Start position (inclusive)
 * @param endInclusive End position (inclusive)
 * @param step The amount to increment.
 */
export function createRangeIter(
    start: number,
    endInclusive: number,
    step = 1
): IterableIterator<number> {
    const positive = endInclusive >= start
    if (
        (endInclusive > start && step <= 0) ||
        (endInclusive < start && step >= 0)
    ) {
        throw new IllegalArgumentError('Iterator will never complete.')
    }
    let i = start
    return {
        [Symbol.iterator](): IterableIterator<number> {
            return this
        },

        next: (): IteratorResult<number> => {
            const result = {
                value: i,
                done: positive ? i > endInclusive : i < endInclusive,
            }
            i += step
            return result
        },
    }
}

/**
 * Maps an iterable object using the given transform.
 * Unlike `Array#map`, this doesn't create a new Array in memory, the transform is done on
 * iteration.
 *
 * @param iterable
 * @param transform Transforms each element as it's requested.
 */
export function mapIter<T, U>(
    iterable: Iterable<T>,
    transform: (element: T) => U
): IterableIterator<U> {
    const it: Iterator<T> = iterable[Symbol.iterator]()
    return {
        [Symbol.iterator](): IterableIterator<U> {
            return mapIter(iterable, transform)
        },
        next: (): IteratorResult<U> => {
            const result = it.next()
            if (result.done) return result
            return {
                value: transform(result.value),
                done: false,
            }
        },
    }
}

export function filterIter<T, S extends T>(
    iterable: Iterable<T>,
    predicate: (value: T) => value is S
): IterableIterator<S>

export function filterIter<T>(
    iterable: Iterable<T>,
    predicate: (value: T) => boolean
): IterableIterator<T>

/**
 * Filters an iterable object using the given predicate.
 * Unlike `Array#filter`, this doesn't create a new Array in memory, the filter is done on
 * iteration.
 *
 * @param iterable
 * @param predicate Returns true if the element should be included in the new iteration.
 */
export function filterIter<T>(
    iterable: Iterable<T>,
    predicate: (value: T) => boolean
): IterableIterator<T> {
    const it = iterable[Symbol.iterator]()
    return {
        [Symbol.iterator](): IterableIterator<T> {
            return filterIter(iterable, predicate)
        },

        next: (): IteratorResult<T> => {
            while (true) {
                const next = it.next()
                if (next.done) {
                    return {
                        value: undefined,
                        done: true,
                    }
                } else if (predicate(next.value)) {
                    return {
                        value: next.value,
                        done: false,
                    }
                }
            }
        },
    }
}
