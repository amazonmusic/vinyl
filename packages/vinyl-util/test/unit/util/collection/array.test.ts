/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    chunk,
    compare,
    countElements,
    createArrayLikeIterator,
    every,
    everyAsync,
    filter,
    filterAsync,
    find,
    findIndex,
    first,
    forEach,
    forEachAsync,
    getElementAt,
    getElementOrDefault,
    IllegalArgumentError,
    indexOf,
    indexOfHighest,
    last,
    lastIndexOf,
    lastIndexOfHighest,
    map,
    mapAsync,
    max,
    min,
    remove,
    removeAt,
    sleep,
    some,
    someAsync,
    sortedInsertionIndex,
    takeFirst,
    takeLast,
} from '@amazon/vinyl-util'
import {
    expectIterableEquals,
    useMockTime,
} from '@amazon/vinyl-util/browserTestUtil'
import createSpy = jasmine.createSpy

describe('array utils', () => {
    const clock = useMockTime()

    describe('indexOf', () => {
        it('accepts an ArrayLike', () => {
            const arrayLike = new Uint8Array([0, 1, 2, 3, 4, 3])
            expect(indexOf(arrayLike, 3)).toBe(3)
        })
    })
    describe('lastIndexOf', () => {
        it('accepts an ArrayLike', () => {
            const arrayLike = new Uint8Array([3, 1, 2, 3, 4, 5])
            expect(lastIndexOf(arrayLike, 3)).toBe(3)
        })
    })
    describe('filter', () => {
        it('accepts an ArrayLike', () => {
            const arrayLike = new Uint8Array([0, 1, 2, 3, 4, 5])
            expect(filter(arrayLike, (e) => e > 2)).toEqual([3, 4, 5])
        })
        it('performs a narrowing conversion', () => {
            const arr = [true, false, true, false]
            const trues: true[] = filter(arr, (e): e is true => e)
            expect(trues).toEqual([true, true])
        })
    })

    describe('filterAsync', () => {
        it('accepts an ArrayLike', async () => {
            const arrayLike = new Uint8Array([0, 1, 2, 3, 4, 5])
            await expectAsync(
                filterAsync(arrayLike, (e) => Promise.resolve(e > 2))
            ).toBeResolvedTo([3, 4, 5])
        })

        it('accepts a promise to an ArrayLike', async () => {
            const arrayLike = new Uint8Array([0, 1, 2, 3, 4, 5])
            await expectAsync(
                filterAsync(Promise.resolve(arrayLike), (e) =>
                    Promise.resolve(e > 2)
                )
            ).toBeResolvedTo([3, 4, 5])
        })
    })

    describe('map', () => {
        it('accepts an ArrayLike', () => {
            const arrayLike = new Uint8Array([0, 1, 2])
            expect(map(arrayLike, (e) => `test_${e}`)).toEqual([
                'test_0',
                'test_1',
                'test_2',
            ])
        })
        it('passes ArrayLike as parameter', () => {
            const arrayLike = new Uint8Array([33])
            const transformSpy = createSpy()
            map(arrayLike, transformSpy)
            expect(transformSpy).toHaveBeenCalledWith(33, 0, arrayLike)
        })
    })

    describe('mapAsync', () => {
        it('transforms an array with an asynchronous transformer in parallel', async () => {
            const mapped = mapAsync(
                [1, 2, 3, 4, 5],
                async (element) => {
                    await sleep(1)
                    return element * 2
                },
                { simultaneous: 5 }
            )
            await expectAsync(mapped).toBePending()
            await clock.tick(1)
            expect(await mapped).toEqual([2, 4, 6, 8, 10])
        })

        it('supports simultaneous option to limit concurrency', async () => {
            const mapped = mapAsync(
                [1, 2, 3, 4, 5],
                (element) => {
                    return Promise.resolve(element * 2)
                },
                { simultaneous: 2 }
            )
            expect(await mapped).toEqual([2, 4, 6, 8, 10])
        })

        it('defaults to simultaneous=1 when not specified', async () => {
            const mapped = mapAsync([1, 2, 3], (element) => {
                return Promise.resolve(element * 2)
            })
            expect(await mapped).toEqual([2, 4, 6])
        })

        it('processes all items when simultaneous >= array length', async () => {
            const mapped = mapAsync(
                [1, 2, 3],
                (element) => Promise.resolve(element * 2),
                { simultaneous: 5 }
            )
            expect(await mapped).toEqual([2, 4, 6])
        })

        it('maintains order with limited concurrency', async () => {
            const mapped = mapAsync(
                [0, 1, 2],
                (element) => Promise.resolve(element),
                { simultaneous: 1 }
            )
            expect(await mapped).toEqual([0, 1, 2])
        })
    })

    describe('every', () => {
        it('accepts an ArrayLike', () => {
            const arrayLike = new Uint8Array([2, 4, 6, 8])
            expect(every(arrayLike, (e) => e % 2 === 0)).toBe(true)
            expect(every(arrayLike, (e) => e > 5)).toBe(false)
        })
        it('returns true for empty array', () => {
            expect(every([], () => false)).toBe(true)
        })
        it('passes element, index and array to predicate', () => {
            const spy = createSpy().and.returnValue(true)
            const arrayLike = new Uint8Array([1, 2])
            every(arrayLike, spy)
            expect(spy).toHaveBeenCalledWith(1, 0, arrayLike)
            expect(spy).toHaveBeenCalledWith(2, 1, arrayLike)
        })
    })

    describe('some', () => {
        it('accepts an ArrayLike', () => {
            const arrayLike = new Uint8Array([1, 3, 5, 8])
            expect(some(arrayLike, (e) => e % 2 === 0)).toBe(true)
            expect(some(arrayLike, (e) => e > 10)).toBe(false)
        })
        it('returns false for empty array', () => {
            expect(some([], () => true)).toBe(false)
        })
        it('passes element, index and array to predicate', () => {
            const spy = createSpy().and.returnValue(false)
            const arrayLike = new Uint8Array([1, 2])
            some(arrayLike, spy)
            expect(spy).toHaveBeenCalledWith(1, 0, arrayLike)
            expect(spy).toHaveBeenCalledWith(2, 1, arrayLike)
        })
    })

    describe('everyAsync', () => {
        it('tests whether each element in an array passes an asynchronous test function', async () => {
            const predicate = async (element: number) => {
                await sleep(1)
                return element % 2 === 0
            }
            const v1 = everyAsync([2, 4, 6], predicate, { simultaneous: 3 })
            await expectAsync(v1).toBePending()
            await clock.tick(1)
            expect(await v1).toBe(true)

            const v2 = everyAsync([2, 5, 6], predicate, { simultaneous: 3 })
            await expectAsync(v2).toBePending()
            await clock.tick(1)
            expect(await v2).toBe(false)
        })

        it('returns early when a false result is found', async () => {
            let callCount = 0
            const predicate = async (element: number) => {
                callCount++
                await sleep(1)
                return element % 2 === 0
            }
            const result = everyAsync([2, 4, 5, 6, 8], predicate, {
                simultaneous: 2,
            })
            await expectAsync(result).toBePending()
            await clock.tick(1) // First chunk: [2, 4] - both pass
            await expectAsync(result).toBePending()
            await clock.tick(1) // Second chunk: [5, 6] - 5 fails, should return false
            expect(await result).toBe(false)
            expect(callCount).toBe(4) // Should not call predicate for element 8
        })

        it('defaults to simultaneous=1', async () => {
            let callCount = 0
            const predicate = async (_element: number) => {
                callCount++
                return Promise.resolve(true)
            }
            const result = everyAsync([2, 4, 6], predicate)
            expect(await result).toBe(true)
            expect(callCount).toBe(3) // Should call all elements sequentially
        })
    })

    describe('someAsync', () => {
        it('tests whether any element in an array passes an asynchronous test function', async () => {
            const predicate = async (element: number) => {
                await sleep(1)
                return element % 2 === 0
            }
            const v1 = someAsync([1, 2, 3], predicate, { simultaneous: 3 })
            await expectAsync(v1).toBePending()
            await clock.tick(1)
            expect(await v1).toBe(true)

            const v2 = someAsync(Promise.resolve([3, 5, 7]), predicate, {
                simultaneous: 3,
            })
            await expectAsync(v2).toBePending()
            await clock.tick(1)
            expect(await v2).toBe(false)
        })

        it('returns early when a true result is found', async () => {
            let callCount = 0
            const predicate = async (element: number) => {
                callCount++
                await sleep(1)
                return element % 2 === 0
            }
            const result = someAsync([1, 3, 4, 5, 6], predicate, {
                simultaneous: 2,
            })
            await expectAsync(result).toBePending()
            await clock.tick(1) // First chunk: [1, 3] - both fail
            await expectAsync(result).toBePending()
            await clock.tick(1) // Second chunk: [4, 5] - 4 passes, should return true
            expect(await result).toBe(true)
            expect(callCount).toBe(4) // Should not call predicate for element 6
        })

        it('defaults to simultaneous=1', async () => {
            let callCount = 0
            const predicate = async (_element: number) => {
                callCount++
                return Promise.resolve(false)
            }
            const result = someAsync([1, 3, 5], predicate)
            expect(await result).toBe(false)
            expect(callCount).toBe(3) // Should call all elements sequentially
        })
    })

    describe('forEach', () => {
        it('accepts an ArrayLike', () => {
            const arrayLike = new Uint8Array([0, 1, 2])
            const p = createSpy()
            forEach(arrayLike, p)
            expect(p).toHaveBeenCalledTimes(3)
        })
    })

    describe('forEachAsync', () => {
        it('executes an asynchronous function on every element in a list', async () => {
            const executor = async (element: number) => {
                await sleep(element)
            }
            {
                const promise = forEachAsync(
                    Promise.resolve([1, 2, 3]),
                    executor,
                    { simultaneous: 3 }
                )
                await expectAsync(promise).toBePending()
                await clock.tick(2.9)
                await expectAsync(promise).toBePending()
                await clock.tick(0.1)
                await expectAsync(promise).toBeResolved()
            }

            {
                const promise = forEachAsync(
                    sleep(1).then(() => [3, 1, 4]),
                    executor,
                    { simultaneous: 3 }
                )
                await expectAsync(promise).toBePending()
                await clock.tick(1, 4 - 0.1)
                await expectAsync(promise).toBePending()
                await clock.tick(0.1)
                await expectAsync(promise).toBeResolved()
            }
        })

        it('accepts a promise to an array-like', async () => {
            const executor = async (element: number) => {
                await sleep(element)
            }
            {
                const promise = forEachAsync(
                    Promise.resolve([1, 2, 3]),
                    executor,
                    { simultaneous: 3 }
                )
                await expectAsync(promise).toBePending()
                await clock.tick(2.9)
                await expectAsync(promise).toBePending()
                await clock.tick(0.1)
                await expectAsync(promise).toBeResolved()
            }
        })
    })

    describe('find', () => {
        it('returns the element on a match', () => {
            const arrayLike = new Uint8Array([0, 1, 2])
            expect(find(arrayLike, (e) => e === 0)).toBe(0)
            expect(find(arrayLike, (e) => e === 1)).toBe(1)
            expect(find(arrayLike, (e) => e === 2)).toBe(2)
        })
        it('returns the first element on multiple matches', () => {
            const arrayLike = new Uint8Array([0, 1, 2, 3, 4])
            const r = find(arrayLike, (e) => e >= 2)
            expect(r).toBe(2)
        })
        it('returns undefined when there is no match', () => {
            const arrayLike = new Uint8Array([0, 1, 2])
            const r = find(arrayLike, () => false)
            expect(r).toBeUndefined()
        })
        it('performs narrowing conversion', () => {
            const arrayLike = new Uint8Array([0, 1, 2])
            const r: 0 | undefined = find(arrayLike, (e): e is 0 => e === 0)
            expect(r).toEqual(0)
        })
    })
    describe('findIndex', () => {
        it('returns the index of element on a match', () => {
            const arrayLike = new Uint8Array([0, 1, 2])
            expect(findIndex(arrayLike, (e) => e === 0)).toBe(0)
            expect(findIndex(arrayLike, (e) => e === 1)).toBe(1)
            expect(findIndex(arrayLike, (e) => e === 2)).toBe(2)
        })
        it('returns first element on multiple matches', () => {
            const arrayLike = new Uint8Array([0, 1, 2, 3, 4])
            const r = findIndex(arrayLike, (e) => e >= 2)
            expect(r).toBe(2)
        })
        it('returns -1 when there is no match', () => {
            const arrayLike = new Uint8Array([0, 1, 2])
            const r = findIndex(arrayLike, () => false)
            expect(r).toBe(-1)
        })
    })

    describe('first', () => {
        it('returns the first element of an array like', () => {
            expect(first(new Uint8Array([1, 2, 3]))).toBe(1)
            expect(first(new Uint8Array([2, 3]))).toBe(2)
            expect(first(new Uint8Array([]))).toBeUndefined()
        })

        it('returns undefined if array like is undefined', () => {
            expect(first(undefined)).toBeUndefined()
        })
    })

    describe('last', () => {
        it('returns the last element of an array like', () => {
            expect(last(new Uint8Array([1, 2, 3]))).toBe(3)
            expect(last(new Uint8Array([3, 4]))).toBe(4)
            expect(last(new Uint8Array([]))).toBeUndefined()
        })

        it('returns undefined if array like is undefined', () => {
            expect(last(undefined)).toBeUndefined()
        })
    })

    describe('takeFirst', () => {
        it('returns the first n elements of an array', () => {
            expect(takeFirst(new Uint8Array([1, 2, 3]), 2)).toEqual([1, 2])
            expect(takeFirst(new Uint8Array([1, 2, 3, 4]), 5)).toEqual([
                1, 2, 3, 4,
            ])
        })

        describe('when count is less than 0', () => {
            it('returns an empty array', () => {
                expect(takeFirst(new Uint8Array([1, 2, 3]), 0)).toEqual([])
                expect(takeFirst(new Uint8Array([1, 2, 3]), -2)).toEqual([])
            })
        })
    })

    describe('takeLast', () => {
        it('returns the last n elements of an array', () => {
            expect(takeLast(new Uint8Array([1, 2, 3]), 2)).toEqual([2, 3])
            expect(takeLast(new Uint8Array([1, 2, 3, 4]), 5)).toEqual([
                1, 2, 3, 4,
            ])
        })

        describe('when count is less than 0', () => {
            it('returns an empty array', () => {
                expect(takeLast(new Uint8Array([1, 2, 3]), 0)).toEqual([])
                expect(takeLast(new Uint8Array([1, 2, 3]), -2)).toEqual([])
            })
        })
    })

    describe('remove', () => {
        it('removes the given element from an array', () => {
            const arr = [1, 2, 3]
            expect(remove(arr, 2)).toBeTrue()
            expect(arr).toEqual([1, 3])
            remove(arr, 1)
            expect(arr).toEqual([3])
        })

        it('returns false if element is not found', () => {
            expect(remove([1, 2, 3], -1)).toBe(false)
            expect(remove([1, 2, 3], NaN)).toBe(false)
            expect(remove([1, 2, 3], 3)).toBe(true)
        })
    })

    describe('removeAt', () => {
        it('removes the element at the given index', () => {
            const arr = [1, 2, 3]
            expect(removeAt(arr, 2)).toBe(3)
            expect(arr).toEqual([1, 2])
            expect(removeAt(arr, 0)).toBe(1)
            expect(arr).toEqual([2])
            expect(removeAt(arr, 0)).toBe(2)
            expect(arr).toEqual([])
        })

        it('removes length + index for negative indices', () => {
            const arr = [1, 2, 3, 4]
            expect(removeAt(arr, -1)).toBe(4)
            expect(arr).toEqual([1, 2, 3])
            expect(removeAt(arr, -3)).toBe(1)
            expect(arr).toEqual([2, 3])
        })

        it('returns undefined if the index is out of range', () => {
            expect(removeAt([1, 2, 3], 3)).toBeUndefined()
        })
    })

    describe('indexOfHighest', () => {
        it('returns the index of the element with the highest comparative value', () => {
            expect(indexOfHighest([3, 2, 0, 5, 9, 2, 3, 3], compare)).toBe(4) // value 9
        })

        it('returns the earlier index for equal comparisons', () => {
            expect(indexOfHighest([3, 2, 9, 5, 9, 2, 3, 9], compare)).toBe(2) // value 9
        })

        it('returns -1 if list is empty', () => {
            expect(indexOfHighest([], compare)).toBe(-1)
        })

        it('returns 0 if list length is 1', () => {
            expect(indexOfHighest([0], compare)).toBe(0)
        })
    })

    describe('lastIndexOfHighest', () => {
        it('returns the last index of the element with the highest comparative value', () => {
            expect(lastIndexOfHighest([3, 2, 0, 5, 9, 2, 3, 3], compare)).toBe(
                4
            ) // value 9
        })

        it('returns the later index for equal comparisons', () => {
            expect(lastIndexOfHighest([3, 2, 9, 5, 9, 2, 3, 9], compare)).toBe(
                7
            ) // value 9
        })

        it('returns -1 if list is empty', () => {
            expect(lastIndexOfHighest([], compare)).toBe(-1)
        })

        it('returns 0 if list length is 1', () => {
            expect(lastIndexOfHighest([0], compare)).toBe(0)
        })
    })

    describe('sortedInsertionIndex', () => {
        it('returns the index the given value should be inserted in a sorted list', () => {
            const arr = [1, 9, 13, 15, 17]
            expect(sortedInsertionIndex(arr, -1, compare)).toBe(0)
            expect(sortedInsertionIndex(arr, 0, compare)).toBe(0)
            expect(sortedInsertionIndex(arr, 1, compare)).toBe(1)
            expect(sortedInsertionIndex(arr, 11, compare)).toBe(2)
            expect(sortedInsertionIndex(arr, 13, compare)).toBe(3)
            expect(sortedInsertionIndex(arr, 16, compare)).toBe(4)
            expect(sortedInsertionIndex(arr, 17, compare)).toBe(5)
            expect(sortedInsertionIndex(arr, 23, compare)).toBe(5)
        })

        it('accepts start and end ranges', () => {
            const arr = [-20, -20, -13, 10, 10, 15, 30, 60, 90]
            expect(sortedInsertionIndex(arr, -1, compare, 4, 6)).toBe(4)
            expect(sortedInsertionIndex(arr, 999, compare, 4, 6)).toBe(6)
        })
    })

    describe('arrayLikeIterator', () => {
        describe('when the ArrayLike has Symbol.iterator', () => {
            it('returns that iterator', () => {
                const arr: number[] = [0, 1, 2, 3, 4]
                const it = arr[Symbol.iterator]()
                spyOn(arr, Symbol.iterator).and.returnValue(it)
                expect(createArrayLikeIterator(arr)).toBe(it)
                expectIterableEquals(
                    createArrayLikeIterator(arr),
                    [0, 1, 2, 3, 4]
                )
            })
        })

        describe('when the ArrayLike does not have Symbol.iterator', () => {
            it('returns an iterator', () => {
                const arrayLike = new Proxy(
                    {},
                    {
                        get(_target, prop) {
                            if (typeof prop === 'symbol') return undefined
                            const n = Number(prop)
                            if (!Number.isNaN(n)) {
                                return 1
                            } else if (prop === 'length') {
                                return 3
                            }
                            return undefined
                        },
                    }
                ) as ArrayLike<number>

                expectIterableEquals(
                    createArrayLikeIterator(arrayLike),
                    [1, 1, 1]
                )
            })
        })
    })

    describe('getElementAt', () => {
        it('returns the element at the given index or throws an IllegalArgumentError', () => {
            expect(getElementAt([1, 2, 3], 0)).toEqual(1)
            expect(getElementAt([1, 2, 3], 2)).toEqual(3)
            expect(() => getElementAt([1, 2, 3], -1)).toThrowError(
                IllegalArgumentError
            )
            expect(() => getElementAt([1, 2, 3], Number.NaN)).toThrowError(
                IllegalArgumentError
            )
            expect(() =>
                getElementAt(
                    [1, 2, 3],
                    // @ts-expect-error Expected number
                    undefined
                )
            ).toThrowError(IllegalArgumentError)
        })
    })

    describe('getElementOrDefault', () => {
        it('returns the element at the given index or returns the given default value', () => {
            expect(getElementOrDefault([1, 2, 3], 0, null)).toEqual(1)
            expect(getElementOrDefault([1, 2, 3], 2, null)).toEqual(3)
            expect(getElementOrDefault([1, 2, 3], -1, null)).toBeNull()
            expect(getElementOrDefault([1, 2, 3], -1, -1)).toBe(-1)
            expect(getElementOrDefault([1, 2, 3], 10, -1)).toBe(-1)
            expect(getElementOrDefault([1, 2, 3], Number.NaN, 999)).toBe(999)
            expect(
                getElementOrDefault(
                    [1, 2, 3],
                    // @ts-expect-error Expected number
                    undefined,
                    999
                )
            ).toBe(999)
        })
    })

    describe('countElements', () => {
        it('counts the number of elements that pass a predicate function', () => {
            expect(countElements([1, 2, 3, 4, 5], (e) => e % 2 === 0)).toBe(2)
            expect(countElements([1, 2, 3, 4, 5], () => false)).toBe(0)
            expect(countElements([1, 2, 3, 4, 5], () => true)).toBe(5)
        })

        it('passes the element, index and array to the predicate', () => {
            const spy = createSpy().and.returnValue(false)
            const arr = ['a', 'b', 'c', 'd']
            countElements(arr, spy)
            expect(spy.calls.first().args).toEqual(['a', 0, arr])
            expect(spy.calls.mostRecent().args).toEqual(['d', 3, arr])
        })
    })

    describe('chunk', () => {
        it('splits array into chunks of specified size', () => {
            expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
            expect(chunk([1, 2, 3, 4, 5, 6], 3)).toEqual([
                [1, 2, 3],
                [4, 5, 6],
            ])
        })

        it('handles arrays that divide evenly', () => {
            expect(chunk([1, 2, 3, 4], 2)).toEqual([
                [1, 2],
                [3, 4],
            ])
        })

        it('handles empty arrays', () => {
            expect(chunk([], 2)).toEqual([])
        })

        it('handles chunk size larger than array', () => {
            expect(chunk([1, 2, 3], 5)).toEqual([[1, 2, 3]])
        })

        it('handles chunk size of 1', () => {
            expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]])
        })

        it('works with ArrayLike objects', () => {
            const arrayLike = new Uint8Array([1, 2, 3, 4, 5])
            expect(chunk(arrayLike, 2)).toEqual([[1, 2], [3, 4], [5]])
        })
    })

    describe('min', () => {
        it('finds minimum value in array of numbers', () => {
            expect(min([3, 1, 4, 1, 5])).toBe(1)
            expect(min([10])).toBe(10)
        })

        it('finds minimum value in array of strings', () => {
            expect(min(['c', 'a', 'b'])).toBe('a')
        })

        it('returns undefined for empty array', () => {
            expect(min([])).toBeUndefined()
        })

        it('works with ArrayLike objects', () => {
            const arrayLike = new Uint8Array([5, 2, 8, 1, 9])
            expect(min(arrayLike)).toBe(1)
        })

        it('accepts custom comparator', () => {
            const arr = [{ val: 3 }, { val: 1 }, { val: 4 }]
            const result = min(arr, (a, b) => a.val - b.val)
            expect(result).toEqual({ val: 1 })
        })
    })

    describe('max', () => {
        it('finds maximum value in array of numbers', () => {
            expect(max([3, 1, 4, 1, 5])).toBe(5)
            expect(max([10])).toBe(10)
        })

        it('finds maximum value in array of strings', () => {
            expect(max(['c', 'a', 'b'])).toBe('c')
        })

        it('returns undefined for empty array', () => {
            expect(max([])).toBeUndefined()
        })

        it('works with ArrayLike objects', () => {
            const arrayLike = new Uint8Array([5, 2, 8, 1, 9])
            expect(max(arrayLike)).toBe(9)
        })

        it('accepts custom comparator', () => {
            const arr = [{ val: 3 }, { val: 1 }, { val: 4 }]
            const result = max(arr, (a, b) => a.val - b.val)
            expect(result).toEqual({ val: 4 })
        })
    })
})
