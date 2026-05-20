/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IllegalStateError, LruCache } from '@amazon/vinyl-util'
import createSpy = jasmine.createSpy

describe('LruCache', () => {
    describe('capacity', () => {
        it('returns the capacity set in construction', () => {
            expect(new LruCache(3).capacity).toBe(3)
        })

        it('can be set', () => {
            const cache = new LruCache(3)
            expect(cache.capacity).toBe(3)
            cache.capacity = 2
            expect(cache.capacity).toBe(2)
        })

        it('when reduced below current size, evicts least recently used elements', () => {
            const cache = new LruCache<string, number>(4)
            const onEvictSpy = createSpy('onEvict')
            cache.onEvict = onEvictSpy
            cache.set('a', 1).set('b', 2).set('c', 3).set('d', 4)

            expect(cache.onEvict).not.toHaveBeenCalled()

            cache.capacity = 2

            expect(cache.onEvict).toHaveBeenCalledWith(1, 'a', cache)
            expect(cache.onEvict).toHaveBeenCalledWith(2, 'b', cache)
            expect(Array.from(cache)).toEqual([
                ['c', 3],
                ['d', 4],
            ])

            onEvictSpy.calls.reset()

            cache.capacity = 4
            expect(onEvictSpy).not.toHaveBeenCalled()
            expect(Array.from(cache)).toEqual([
                ['c', 3],
                ['d', 4],
            ])
            cache.set('a', 1).set('b', 2)
            expect(Array.from(cache)).toEqual([
                ['c', 3],
                ['d', 4],
                ['a', 1],
                ['b', 2],
            ])
        })
    })

    describe('size', () => {
        it('returns the size of the cache', () => {
            const capacity = 10
            const cache = new LruCache<string, number>(capacity)
            expect(cache.size).toBe(0)
            cache.set('a', 1).set('b', 2).set('c', 3)
            expect(cache.size).toBe(3)
            cache.delete('a')
            expect(cache.size).toBe(2)
            for (let i = 0; i < capacity; i++) {
                cache.set(`key_${i}`, i)
            }
            expect(cache.size).toBe(capacity)
        })
    })

    describe('has', () => {
        it('returns true if the cache has the given key', () => {
            const cache = new LruCache<string, number>(10)
            cache.set('a', 1).set('b', 2).set('c', 3)
            expect(cache.has('a')).toBeTrue()
            expect(cache.has('missing')).toBeFalse()
        })
    })

    describe('get', () => {
        it('returns an element from the cache by key', () => {
            const cache = new LruCache<string, number>(10)
            cache.set('a', 1).set('b', 2).set('c', 3)
            expect(cache.get('a')).toBe(1)
            expect(cache.get('b')).toBe(2)
            expect(cache.get('c')).toBe(3)
        })

        it('moves an element to most recently used position', () => {
            const cache = new LruCache<string, number>(10)
            cache.set('a', 1).set('b', 2).set('c', 3)
            expect(cache.get('a')).toBe(1)
            expect(Array.from(cache)).toEqual([
                ['b', 2],
                ['c', 3],
                ['a', 1],
            ])
        })

        it('returns undefined if key is not present', () => {
            const cache = new LruCache<string, number>(10)
            expect(cache.get('a')).toBe(undefined)
        })
    })

    describe('set', () => {
        it('sets an element in the cache', () => {
            const cache = new LruCache<string, number>(10)
            cache.set('a', 1).set('b', 2).set('c', 3)
            expect(Array.from(cache)).toEqual([
                ['a', 1],
                ['b', 2],
                ['c', 3],
            ])
        })

        it('removes the oldest element when capacity has been reached', () => {
            const capacity = 5
            const cache = new LruCache<string, number>(capacity)
            for (let i = 0; i < capacity; i++) {
                cache.set(`key_${i}`, i)
            }
            expect(Array.from(cache)).toEqual([
                ['key_0', 0],
                ['key_1', 1],
                ['key_2', 2],
                ['key_3', 3],
                ['key_4', 4],
            ])
            cache.set('key_5', 5)
            expect(Array.from(cache)).toEqual([
                ['key_1', 1],
                ['key_2', 2],
                ['key_3', 3],
                ['key_4', 4],
                ['key_5', 5],
            ])
            cache.set('key_6', 6)
            expect(Array.from(cache)).toEqual([
                ['key_2', 2],
                ['key_3', 3],
                ['key_4', 4],
                ['key_5', 5],
                ['key_6', 6],
            ])
        })

        it('replaces an element in the cache and moves it to most recently used', () => {
            const cache = new LruCache<string, number>(10)
            cache.set('a', 1).set('b', 2).set('c', 3)
            cache.set('a', 4)
            expect(Array.from(cache)).toEqual([
                ['b', 2],
                ['c', 3],
                ['a', 4],
            ])
        })
    })

    describe('clear', () => {
        it('clears all items from the cache', () => {
            const cache = new LruCache<string, number>(10)
            cache.set('a', 1).set('b', 2).set('c', 3).set('d', 4).set('e', 5)
            cache.get('c')
            cache.get('b')
            cache.clear()
            expect(cache.size).toBe(0)
            expect(Array.from(cache)).toEqual([])
        })
    })

    describe('delete', () => {
        it('removes an element from the cache', () => {
            const cache = new LruCache<string, number>(10)
            cache.set('a', 1).set('b', 2).set('c', 3).set('d', 4)
            cache.get('a')
            cache.get('b')
            expect(cache.delete('b')).toBeTrue()
            expect(cache.has('b')).toBeFalse()
            expect(Array.from(cache)).toEqual([
                ['c', 3],
                ['d', 4],
                ['a', 1],
            ])
        })

        it('returns false if the element is not in the cache', () => {
            const cache = new LruCache<string, number>(10)
            expect(cache.delete('b')).toBeFalse()
        })
    })

    describe('forEach', () => {
        it(
            'calls a callback for every entry of the cache, ordered from least ' +
                'recently used to most',
            () => {
                const cache = new LruCache<string, number>(10)
                cache
                    .set('a', 1)
                    .set('b', 2)
                    .set('c', 3)
                    .set('d', 4)
                    .set('e', 5)
                cache.get('c')
                cache.get('b')
                const actual: [
                    value: number,
                    key: string,
                    map: LruCache<string, number>,
                ][] = []
                cache.forEach((value, key, map) =>
                    actual.push([value, key, map])
                )
                expect(actual).toEqual([
                    [1, 'a', cache],
                    [4, 'd', cache],
                    [5, 'e', cache],
                    [3, 'c', cache],
                    [2, 'b', cache],
                ])
            }
        )

        it('accepts a thisArg', () => {
            const cache = new LruCache<string, number>(10)
            cache.set('a', 1).set('b', 2)

            const a = {}
            const spy = createSpy()
            cache.forEach(spy, a)
            expect(spy.calls.thisFor(0)).toBe(a)
            expect(spy.calls.thisFor(1)).toBe(a)
        })
    })

    describe('entries', () => {
        it(
            'returns an iterator for entries of the cache, ordered from least ' +
                'recently used to most',
            () => {
                const cache = new LruCache<string, number>(10)
                cache
                    .set('a', 1)
                    .set('b', 2)
                    .set('c', 3)
                    .set('d', 4)
                    .set('e', 5)
                cache.get('c')
                cache.get('b')
                expect(Array.from(cache.entries())).toEqual([
                    ['a', 1],
                    ['d', 4],
                    ['e', 5],
                    ['c', 3],
                    ['b', 2],
                ])
            }
        )
    })

    describe('keys', () => {
        it(
            'returns an iterator for keys of the cache, ordered from least ' +
                'recently used to most',
            () => {
                const cache = new LruCache<string, number>(10)
                cache
                    .set('a', 1)
                    .set('b', 2)
                    .set('c', 3)
                    .set('d', 4)
                    .set('e', 5)
                cache.get('c')
                cache.get('b')
                expect(Array.from(cache.keys())).toEqual([
                    'a',
                    'd',
                    'e',
                    'c',
                    'b',
                ])
            }
        )
    })

    describe('values', () => {
        it(
            'returns an iterator for values of the cache, ordered from least ' +
                'recently used to most',
            () => {
                const cache = new LruCache<string, number>(10)
                cache
                    .set('a', 1)
                    .set('b', 2)
                    .set('c', 3)
                    .set('d', 4)
                    .set('e', 5)
                cache.get('c')
                cache.get('b')
                expect(Array.from(cache.values())).toEqual([1, 4, 5, 3, 2])
            }
        )
    })

    describe('Symbol.iterator', () => {
        it(
            'returns an iterator for the entries of the cache, ordered from least ' +
                'recently used to most',
            () => {
                const cache = new LruCache<string, number>(10)
                cache
                    .set('a', 1)
                    .set('b', 2)
                    .set('c', 3)
                    .set('d', 4)
                    .set('e', 5)
                cache.get('c')
                cache.get('b')
                expect(Array.from(cache)).toEqual([
                    ['a', 1],
                    ['d', 4],
                    ['e', 5],
                    ['c', 3],
                    ['b', 2],
                ])
            }
        )
    })

    describe('Symbol.toStringTag', () => {
        it('returns LruCache', () => {
            const cache = new LruCache<string, number>(3)
            cache.set('a', 3).set('b', 4).set('c', 5)
            expect(cache[Symbol.toStringTag]).toBe('LruCache')
        })
    })

    describe('onEvicting', () => {
        it('allows prevention of evicting a cached element', () => {
            const cache = new LruCache<string, number>(3)
            const onEvict = createSpy('onEvict')
            cache.onEvict = onEvict
            cache.set('a', 1).set('b', 2).set('c', 3)

            cache.onEvicting = (element, _key) => {
                return element % 2 === 0 // Only evict even numbers
            }

            expect(cache.onEvict).not.toHaveBeenCalled()
            cache.set('d', 4)
            expect(onEvict).toHaveBeenCalledOnceWith(2, 'b', cache)
            onEvict.calls.reset()
            cache.set('e', 5)
            expect(onEvict).toHaveBeenCalledOnceWith(4, 'd', cache)
            onEvict.calls.reset()
            cache.set('f', 6)
            expect(onEvict).toHaveBeenCalledOnceWith(6, 'f', cache)
            onEvict.calls.reset()

            // All elements in the cache are odd, nothing allowed to evict
            expect(() => cache.set('g', 7)).toThrowMatching(
                (error) => error instanceof IllegalStateError
            )
        })
    })

    describe('onEvict', () => {
        it('is invoked when an element has been evicted from reaching capacity', () => {
            const cache = new LruCache<string, number>(3)
            const onEvict = createSpy('onEvict')
            cache.onEvict = onEvict
            cache.set('a', 1).set('b', 2).set('c', 3)
            expect(cache.onEvict).not.toHaveBeenCalled()
            cache.set('d', 4)
            expect(onEvict).toHaveBeenCalledOnceWith(1, 'a', cache)
            onEvict.calls.reset()
            cache.set('e', 5)
            expect(cache.onEvict).toHaveBeenCalledOnceWith(2, 'b', cache)
        })
    })
})
