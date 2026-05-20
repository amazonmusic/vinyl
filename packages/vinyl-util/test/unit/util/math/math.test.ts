/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ceilToNearest,
    clamp,
    closeTo,
    floorToNearest,
    lerp,
    roundToNearest,
} from '@amazon/vinyl-util'

describe('math', () => {
    describe('clamp', () => {
        it('clamps a value between min and max', () => {
            expect(clamp(0.5, 0, 1)).toBe(0.5)
            expect(clamp(0, 0, 1)).toBe(0)
            expect(clamp(-1, 0, 1)).toBe(0)
            expect(clamp(2, 0, 1)).toBe(1)
        })

        it('returns max if max is less than min', () => {
            expect(clamp(-1, 5, 2)).toBe(2)
        })
    })

    describe('lerp', () => {
        it('linearly interpolates between from and to', () => {
            expect(lerp(0, 1, 0)).toBe(0)
            expect(lerp(0, 1, 1)).toBe(1)
            expect(lerp(0, 1, 0.5)).toBe(0.5)
            expect(lerp(10, 20, 2)).toBe(30)
            expect(lerp(10, 20, 0.5)).toBe(15)
            expect(lerp(10, 20, -1)).toBe(0)
            expect(lerp(20, 10, 1)).toBe(10)
            expect(lerp(20, 10, 0.5)).toBe(15)
            expect(lerp(-20, 20, 0.5)).toBe(0)
            expect(lerp(-20, -10, 0)).toBe(-20)
            expect(lerp(-20, -10, 0.5)).toBe(-15)
            expect(lerp(-30, 30, 1)).toBe(30)
        })
    })

    describe('floorToNearest', () => {
        it('floors a number to the nearest interval', () => {
            expect(floorToNearest(35, 5)).toBe(35)
            expect(floorToNearest(2150, 100)).toBe(2100)
            expect(floorToNearest(-33, 5)).toBe(-35)
            expect(floorToNearest(-35, 5)).toBe(-35)
        })

        it('floors to the nearest interval after an offset', () => {
            expect(floorToNearest(2150, 100, 25)).toBe(2125)
            expect(floorToNearest(2125, 100, 25)).toBe(2125)
            expect(floorToNearest(2124, 100, 25)).toBe(2025)
            expect(floorToNearest(-33, 5, 1)).toBe(-34)
            expect(floorToNearest(33, 5, 1)).toBe(31)
            expect(floorToNearest(31, 5, 1)).toBe(31)
            expect(floorToNearest(30, 5, 1)).toBe(26)
        })
    })

    describe('ceilToNearest', () => {
        it('ceils a number to the nearest interval', () => {
            expect(ceilToNearest(35, 5)).toBe(35)
            expect(ceilToNearest(2150, 100)).toBe(2200)
            expect(ceilToNearest(-33, 5)).toBe(-30)
            expect(ceilToNearest(-35, 5)).toBe(-35)
            expect(ceilToNearest(35, 5)).toBe(35)
        })

        it('ceils to the nearest interval after an offset', () => {
            expect(ceilToNearest(2150, 100, 25)).toBe(2225)
            expect(ceilToNearest(2125, 100, 25)).toBe(2125)
            expect(ceilToNearest(2124, 100, 25)).toBe(2125)
            expect(ceilToNearest(-33, 5, 1)).toBe(-29)
            expect(ceilToNearest(30, 5, 1)).toBe(31)
            expect(ceilToNearest(31, 5, 1)).toBe(31)
            expect(ceilToNearest(32, 5, 1)).toBe(36)
        })
    })

    describe('roundToNearest', () => {
        it('rounds a number to the nearest interval', () => {
            expect(roundToNearest(2150, 100)).toBe(2200)
            expect(roundToNearest(-8, 10)).toBe(-10)
        })

        it('rounds a number to the nearest interval after an offset', () => {
            expect(roundToNearest(2150, 100, 25)).toBe(2125)
            expect(roundToNearest(10, 10, 1)).toBe(11)
            expect(roundToNearest(-10, 10, 1)).toBe(-9)
            expect(roundToNearest(-10, 10, -1)).toBe(-11)
        })
    })

    describe('closeTo', () => {
        it('returns true if x is within tolerance of y', () => {
            expect(closeTo(0, 0)).toBeTrue()
            expect(closeTo(0, 1e-17)).toBeTrue()
            expect(closeTo(0, -1e-17)).toBeTrue()
            expect(closeTo(0, 1e-13)).toBeFalse()
            expect(closeTo(0, -1e-13)).toBeFalse()
            expect(closeTo(1, 1 + 1e-17)).toBeTrue()
            expect(closeTo(3, 3.099, 0.1)).toBeTrue()
            expect(closeTo(3, 2.91, 0.1)).toBeTrue()
            expect(closeTo(3, 2.89, 0.1)).toBeFalse()
            expect(closeTo(3, 2.11, 0.1)).toBeFalse()
        })
    })
})
