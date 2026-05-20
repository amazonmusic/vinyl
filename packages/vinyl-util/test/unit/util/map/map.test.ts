/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { flipMap, getOrSet } from '@amazon/vinyl-util'
import createSpy = jasmine.createSpy

describe('map', () => {
    describe('getOrSet', () => {
        it('returns values from a map if the key exists', () => {
            const m = new Map()
            m.set('a', 1)
            m.set('b', 2)
            m.set('c', undefined)
            m.set('d', null)
            expect(getOrSet(m, 'a', () => 3)).toEqual(1)
            expect(getOrSet(m, 'b', () => 3)).toEqual(2)
            expect(getOrSet(m, 'c', () => 3)).toEqual(undefined)
            expect(getOrSet(m, 'd', () => 3)).toEqual(null)
        })

        it('sets values on a map if the key does not exist', () => {
            const m = new Map()
            m.set('a', 1)
            m.set('b', 2)
            expect(getOrSet(m, 'c', () => 3)).toEqual(3)
            expect(m.get('c')).toEqual(3)
            expect(getOrSet(m, 'd', () => 4)).toEqual(4)
            expect(m.get('d')).toEqual(4)
        })

        it('provides the key to the given factory', () => {
            const m = new Map()
            const spy = createSpy('factory')
            getOrSet(m, 'c', spy)
            expect(spy).toHaveBeenCalledOnceWith('c')
        })
    })

    describe('flipMap', () => {
        it('swaps keys and values for a map', () => {
            const m = new Map<string, number>([
                ['a', 1],
                ['b', 2],
                ['c', 3],
            ])
            const flipped = flipMap(m)
            expect(flipped.get(1)).toBe('a')
            expect(flipped.get(2)).toBe('b')
            expect(flipped.get(3)).toBe('c')
        })
    })
})
