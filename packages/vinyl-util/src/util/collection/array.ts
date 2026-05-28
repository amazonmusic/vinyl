/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Comparator, compare } from '../comparison/compare'
import type { Maybe, MaybePromise, Primitive } from '../type'
import { IllegalArgumentError } from '../../error/IllegalArgumentError'
import { createTaskQueue } from '../async/TaskQueue'

export type FilterPredicateAsync<T> = (
    value: T,
    index: number,
    array: ArrayLike<T>
) => Promise<boolean>

export type FilterPredicate<T> = (
    value: T,
    index: number,
    array: ArrayLike<T>
) => boolean

/**
 * indexOf on ArrayLike objects.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf
 */
export function indexOf<E>(arrayLike: ArrayLike<E>, element: E): number {
    return Array.prototype.indexOf.call(arrayLike, element)
}

/**
 * lastIndexOf on ArrayLike objects.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/lastIndexOf
 */
export function lastIndexOf<E>(arrayLike: ArrayLike<E>, element: E): number {
    return Array.prototype.lastIndexOf.call(arrayLike, element)
}

export function filter<T, S extends T>(
    arrayLike: ArrayLike<T>,
    predicate: (value: T, index: number, array: ArrayLike<T>) => value is S,
    thisArg?: any
): S[]

export function filter<T>(
    arrayLike: ArrayLike<T>,
    predicate: (value: T, index: number, array: ArrayLike<T>) => boolean,
    thisArg?: any
): T[]

/**
 * filter on ArrayLike objects.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
 */
export function filter<T>(
    arrayLike: ArrayLike<T>,
    predicate: (value: T, index: number, array: ArrayLike<T>) => boolean,
    thisArg?: any
): T[] {
    return Array.prototype.filter.call(arrayLike, predicate, thisArg)
}

/**
 * Filter an ArrayLike with an asynchronous predicate.
 *
 * Runs the predicate across all elements, then filters the elements by the booleans
 * resolved by the predicate.
 *
 * @param arrayLike The array-like object to filter
 * @param predicate Async function that tests each element
 * @param options Optional configuration object
 * @param options.simultaneous Maximum number of predicates to run simultaneously (default: 1)
 */
export async function filterAsync<T>(
    arrayLike: MaybePromise<ArrayLike<T>>,
    predicate: (
        value: T,
        index: number,
        array: ArrayLike<T>
    ) => Promise<boolean>,
    options?: { readonly simultaneous?: number }
): Promise<T[]> {
    const results = await mapAsync(arrayLike, predicate, options)
    return filter(await arrayLike, (_, index) => results[index])
}

/**
 * map on ArrayLike objects.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map
 */
export function map<T, U>(
    arrayLike: ArrayLike<T>,
    transform: (value: T, index: number, array: ArrayLike<T>) => U,
    thisArg?: any
): U[] {
    return Array.prototype.map.call(arrayLike, transform, thisArg) as U[]
}

/**
 * Map on ArrayLike objects with an asynchronous transformer.
 *
 * @param arrayLike The array-like object to transform
 * @param transform Async function that transforms each element
 * @param options Optional configuration object
 * @param options.simultaneous Maximum number of transforms to run simultaneously (default: 1)
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map
 */
export async function mapAsync<T, U>(
    arrayLike: MaybePromise<ArrayLike<T>>,
    transform: (value: T, index: number, array: ArrayLike<T>) => Promise<U>,
    options?: { readonly simultaneous?: number }
): Promise<U[]> {
    const resolvedArray = await arrayLike
    const { simultaneous = 1 } = options || {}

    if (simultaneous >= resolvedArray.length) {
        return Promise.all(map(resolvedArray, transform))
    }

    const results: U[] = new Array(resolvedArray.length)
    const queue = createTaskQueue()
    queue.simultaneous = simultaneous

    const tasks = map(resolvedArray, (value, index) =>
        queue.enqueue(() =>
            transform(value, index, resolvedArray).then((result) => {
                results[index] = result
            })
        )
    )

    await Promise.all(tasks)
    return results
}

/**
 * Determines whether all the members of an array satisfy the specified test.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every
 */
export function every<T>(
    arrayLike: ArrayLike<T>,
    predicate: (value: T, index: number, array: ArrayLike<T>) => boolean,
    thisArg?: any
): boolean {
    return Array.prototype.every.call(arrayLike, predicate, thisArg)
}

/**
 * Determines whether any the members of an array satisfy the specified test.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some
 */
export function some<T>(
    arrayLike: ArrayLike<T>,
    predicate: (value: T, index: number, array: ArrayLike<T>) => boolean,
    thisArg?: any
): boolean {
    return Array.prototype.some.call(arrayLike, predicate, thisArg)
}

/**
 * Determines whether all the members of an array satisfy the specified asynchronous test.
 *
 * @param arrayLike The array-like object to test
 * @param predicate Async function that tests each element
 * @param options Optional configuration object
 * @param options.simultaneous Maximum number of predicates to run simultaneously (default: 1)
 */
export async function everyAsync<T>(
    arrayLike: MaybePromise<ArrayLike<T>>,
    predicate: (
        value: T,
        index: number,
        array: ArrayLike<T>
    ) => Promise<boolean>,
    options?: { readonly simultaneous?: number }
): Promise<boolean> {
    const resolvedArray = await arrayLike

    const chunks = chunk(resolvedArray, options?.simultaneous ?? 1)
    let index = 0

    for (const chunkArray of chunks) {
        const chunkPromises = chunkArray.map((value, chunkIndex) =>
            predicate(value, index + chunkIndex, resolvedArray)
        )
        const chunkResults = await Promise.all(chunkPromises)
        if (chunkResults.some((result) => !result)) {
            return false
        }
        index += chunkArray.length
    }
    return true
}

/**
 * Determines whether any the members of an array satisfy the specified asynchronous test.
 *
 * @param arrayLike The array-like object to test
 * @param predicate Async function that tests each element
 * @param options Optional configuration object
 * @param options.simultaneous Maximum number of predicates to run simultaneously (default: 1)
 */
export async function someAsync<T>(
    arrayLike: MaybePromise<ArrayLike<T>>,
    predicate: (
        value: T,
        index: number,
        array: ArrayLike<T>
    ) => Promise<boolean>,
    options?: { readonly simultaneous?: number }
): Promise<boolean> {
    return !(await everyAsync(
        arrayLike,
        async (value, index, array) => !(await predicate(value, index, array)),
        options
    ))
}

/**
 * forEach on ArrayLike objects.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach
 */
export function forEach<T>(
    arrayLike: ArrayLike<T>,
    action: (value: T, index: number, array: ArrayLike<T>) => void,
    thisArg?: any
): void {
    return Array.prototype.forEach.call(arrayLike, action, thisArg)
}

/**
 * Executes an asynchronous function on each element in an array.
 *
 * @param arrayLike The array-like object to iterate over
 * @param executor Async function to execute for each element
 * @param options Optional configuration object
 * @param options.simultaneous Maximum number of executors to run simultaneously (default: 1)
 */
export function forEachAsync<T>(
    arrayLike: MaybePromise<ArrayLike<T>>,
    executor: (value: T, index: number, array: ArrayLike<T>) => Promise<void>,
    options?: { readonly simultaneous?: number }
): Promise<void> {
    return mapAsync(arrayLike, executor, options).then()
}

export function find<T, S extends T>(
    arrayLike: ArrayLike<T>,
    predicate: (this: void, value: T, index: number, obj: T[]) => value is S,
    thisArg?: any
): S | undefined

export function find<T>(
    arrayLike: ArrayLike<T>,
    predicate: (value: T, index: number, obj: T[]) => boolean,
    thisArg?: any
): T | undefined

/**
 * find on ArrayLike objects
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
 */
export function find<T>(
    arrayLike: ArrayLike<T>,
    predicate: (value: T, index: number, obj: T[]) => boolean,
    thisArg?: any
): T | undefined {
    return Array.prototype.find.call(arrayLike, predicate, thisArg)
}

/**
 * findIndex on ArrayLike objects
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findIndex
 */
export function findIndex<T>(
    arrayLike: ArrayLike<T>,
    predicate: (value: T, index: number, obj: ArrayLike<T>) => unknown,
    thisArg?: any
): number {
    return Array.prototype.findIndex.call(arrayLike, predicate, thisArg)
}

/**
 * Returns the first element of an ArrayLike.
 */
export function first<T>(arrayLike: Maybe<ArrayLike<T>>): T | undefined {
    if (!arrayLike) return undefined
    return arrayLike[0]
}

/**
 * Returns the last element of an ArrayLike.
 */
export function last<T>(arrayLike: Maybe<ArrayLike<T>>): T | undefined {
    if (!arrayLike) return undefined
    return arrayLike[arrayLike.length - 1]
}

/**
 * Returns the first `count` elements of an ArrayLike.
 * @param arrayLike
 * @param count
 */
export function takeFirst<T>(arrayLike: ArrayLike<T>, count: number): T[] {
    if (count <= 0) return []
    return Array.prototype.slice.call(arrayLike, 0, count)
}

/**
 * Returns the last `count` elements of an ArrayLike.
 *
 * @param arrayLike
 * @param count
 */
export function takeLast<T>(arrayLike: ArrayLike<T>, count: number): T[] {
    if (count <= 0) return []
    return Array.prototype.slice.call(arrayLike, -count)
}

/**
 * Returns a subsection of an array-like.
 * For both start and end, a negative index can be used to indicate an offset from the end of
 * the array.
 * For example, -2 refers to the second to last element of the array.
 *
 * @param arrayLike An ArrayLike to copy.
 * @param start The beginning index of the array-like. Default: 0
 * @param end The end index of the specified portion of the array-like (exclusive). Default: length
 */
export function slice<T>(
    arrayLike: ArrayLike<T>,
    start?: number,
    end?: number
): T[] {
    return Array.prototype.slice.call(arrayLike, start, end)
}

/**
 * Removes an element from the array, returning true if it was found.
 */
export function remove<T>(array: T[], element: T): boolean {
    const index = array.indexOf(element)
    if (index === -1) return false
    array.splice(index, 1)
    return true
}

/**
 * Removes an element from the array at the given index, returning the removed element if the index
 * was within range.
 * @param array The Array to update.
 * @param index If negative, will remove from the end of the list (-1 is last element), if
 * greater than or equal to the list length, undefined will be returned.
 */
export function removeAt<T>(array: T[], index: number): T | undefined {
    return array.splice(index, 1)[0]
}

/**
 * Returns the index of the first element in the given array with the highest value according to
 * the comparator.
 * @param array
 * @param comparator
 */
export function indexOfHighest<T>(
    array: ArrayLike<T>,
    comparator: Comparator<T>
): number {
    if (array.length === 0) return -1
    let highestIndex = 0
    let highest = array[highestIndex]
    for (let i = 1; i < array.length; i++) {
        const current = array[i]
        if (comparator(current, highest) > 0) {
            highest = current
            highestIndex = i
        }
    }
    return highestIndex
}

/**
 * Returns the index of the last element in the given array with the highest value according to
 * the comparator.
 * To find the index of the lowest value, use `util.comparator.reversed`
 * @param array
 * @param comparator
 */
export function lastIndexOfHighest<T>(
    array: ArrayLike<T>,
    comparator: Comparator<T>
): number {
    if (array.length === 0) return -1
    let highestIndex = array.length - 1
    let highest = array[highestIndex]
    for (let i = array.length - 2; i >= 0; i--) {
        const current = array[i]
        if (comparator(current, highest) > 0) {
            highest = current
            highestIndex = i
        }
    }
    return highestIndex
}

/**
 * Given an array using the given comparator function, finds the insertion index of an element.
 *
 * @param array An array sorted using the comparator.
 * @param element The element to compare against array elements.
 * @param comparator A function where given the return value of `comparator(element, array[i])`
 * if less than zero the returned index will be before i, otherwise after.
 * @param start The starting index (inclusive). Default: 0
 * @param end The ending index (exclusive). Default: array.length
 */
export function sortedInsertionIndex<T, U = T>(
    array: ArrayLike<T>,
    element: U,
    comparator: Comparator<U, T>,
    start = 0,
    end = array.length
): number {
    let indexA = start
    let indexB = end
    while (indexA < indexB) {
        const midIndex = (indexA + indexB) >>> 1
        const comparison = comparator(element, array[midIndex])
        if (comparison < 0) {
            indexB = midIndex
        } else {
            indexA = midIndex + 1
        }
    }
    return indexA
}

/**
 * Creates an iterator for an ArrayLike.
 * If the given ArrayLike is iterable, then use its provided iterator.
 *
 * @param arrayLike
 */
export function createArrayLikeIterator<T>(
    arrayLike: ArrayLike<T>
): IterableIterator<T> {
    if (Symbol.iterator in arrayLike)
        return (arrayLike as Iterable<T>)[
            Symbol.iterator
        ]() as IterableIterator<T>

    let currentIndex = 0
    return {
        [Symbol.iterator](): IterableIterator<T> {
            return createArrayLikeIterator(arrayLike)
        },

        next: (): IteratorResult<T> => {
            if (currentIndex >= arrayLike.length) {
                return {
                    value: undefined,
                    done: true,
                }
            }
            return {
                value: arrayLike[currentIndex++],
                done: false,
            }
        },
    }
}

/**
 * Gets the element in the ArrayLike at the given index, or throws an IllegalArgumentError if out of range.
 */
export function getElementAt<T>(array: ArrayLike<T>, index: number): T {
    const n = array.length
    if (index >= 0 && index < n) {
        return array[index]
    }
    throw new IllegalArgumentError(`index ${index} is out of range 0-${n}`)
}

/**
 * Gets the element in the ArrayLike at the given index, or returns the provided default value.
 */
export function getElementOrDefault<T, V>(
    array: ArrayLike<T>,
    index: number,
    defaultValue: V
): T | V {
    const n = array.length
    if (index >= 0 && index < n) {
        return array[index]
    }
    return defaultValue
}

/**
 * Counts the number of elements in an array that return true when passed to a predicate function.
 *
 * @param array
 * @param predicate
 */
export function countElements<T>(
    array: ArrayLike<T>,
    predicate: (value: T, index: number, obj: ArrayLike<T>) => boolean
): number {
    let count = 0
    const n = array.length
    for (let i = 0; i < n; i++) {
        if (predicate(array[i], i, array)) {
            count++
        }
    }
    return count
}

/**
 * Splits an array into chunks of the specified size.
 *
 * @param array The array to chunk
 * @param chunkSize Maximum size of each chunk
 * @returns Array of chunks
 */
export function chunk<T>(array: ArrayLike<T>, chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(slice(array, i, i + chunkSize))
    }
    return chunks
}

export function min<T extends Exclude<Primitive, symbol>>(
    arrayLike: ArrayLike<T>
): T | undefined
export function min<T>(
    arrayLike: ArrayLike<T>,
    comparator: Comparator<T>
): T | undefined

/**
 * Finds the minimum value in an array of comparable elements.
 * @param arrayLike The array-like object to search
 * @param comparator Optional comparator function
 */
export function min<T>(
    arrayLike: ArrayLike<T>,
    comparator?: Comparator<T>
): T | undefined {
    if (arrayLike.length === 0) return undefined

    let minValue = arrayLike[0]
    if (!comparator) comparator = compare as Comparator<T>
    for (let i = 1; i < arrayLike.length; i++) {
        if (comparator(arrayLike[i], minValue) < 0) {
            minValue = arrayLike[i]
        }
    }
    return minValue
}

export function max<T extends Exclude<Primitive, symbol>>(
    arrayLike: ArrayLike<T>
): T | undefined
export function max<T>(
    arrayLike: ArrayLike<T>,
    comparator: Comparator<T>
): T | undefined

/**
 * Finds the maximum value in an array of comparable elements.
 * @param arrayLike The array-like object to search
 * @param comparator Optional comparator function
 */
export function max<T>(
    arrayLike: ArrayLike<T>,
    comparator?: Comparator<T>
): T | undefined {
    if (arrayLike.length === 0) return undefined

    let maxValue = arrayLike[0]
    if (!comparator) comparator = compare as Comparator<T>
    for (let i = 1; i < arrayLike.length; i++) {
        if (comparator(arrayLike[i], maxValue) > 0) {
            maxValue = arrayLike[i]
        }
    }
    return maxValue
}
