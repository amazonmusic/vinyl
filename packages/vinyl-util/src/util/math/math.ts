/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Clamps the given value between `min` and `max`.
 *
 * @param value
 * @param min The lower bounds.
 * @param max The upper bounds. If this value is less than min, this value will always be returned.
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
}

/**
 * Linearly interpolates between `from` and `to` given a percentage.
 *
 * @param from The alpha = 0.0 value
 * @param to The alpha = 1.0 value
 * @param alpha A percentage where 0 is `from`, and 1 is `to`. E.g. 0.5 would return halfway
 * between `from` and `to`.
 */
export function lerp(from: number, to: number, alpha: number): number {
    return from + (to - from) * alpha
}

/**
 * Floors a value to the nearest snap interval.
 *
 * Examples:
 *
 * ```
 * floorToNearest(3, 2) // 2
 * floorToNearest(16, 5) // 15
 * floorToNearest(16, 5, 2) // 17
 * ```
 *
 * @param value The value to floor with the given snap interval and offset.
 * @param snap The interval between output values. Should be a finite, non-zero number.
 * @param offset The offset of the interval. E.g. if snap is 10 and offset is 1, values will be
 * snapped to `-19, -9, 1, 11, 21, 31, 41, ...`
 */
export function floorToNearest(
    value: number,
    snap: number,
    offset = 0
): number {
    return Math.floor((value - offset) / snap) * snap + offset
}

/**
 * Ceilings a value to the nearest snap interval.
 *
 * Examples:
 *
 * ```
 * ceilToNearest(3, 2) // 4
 * ceilToNearest(16, 5) // 20
 * ceilToNearest(10, 5) // 10
 * ceilToNearest(16, 5, 2) // 22
 * ```
 *
 * @param value The value to ceil with the given snap interval and offset.
 * @param snap The interval between output values. Should be a finite, non-zero number.
 * @param offset The offset of the interval. E.g. if snap is 10 and offset is 1, values will be
 * snapped to `-19, -9, 1, 11, 21, 31, 41, ...`
 */
export function ceilToNearest(value: number, snap: number, offset = 0): number {
    return Math.ceil((value - offset) / snap) * snap + offset
}

/**
 * Rounds a value to the nearest snap interval.
 *
 * Examples:
 *
 * ```
 * roundToNearest(3, 2) // 4
 * roundToNearest(16, 5) // 15
 * roundToNearest(18, 5) // 20
 * roundToNearest(16, 10, 2) // 22
 * ```
 *
 * @param value The value to round with the given snap interval and offset.
 * @param snap The interval between output values. Should be a finite, non-zero number.
 * @param offset The offset of the interval. E.g. if snap is 10 and offset is 1, values will be
 * snapped to `-19, -9, 1, 11, 21, 31, 41, ...`
 */
export function roundToNearest(
    value: number,
    snap: number,
    offset = 0
): number {
    return Math.round((value - offset) / snap) * snap + offset
}

/**
 * Returns true if `x` is within `tolerance` of `y`.
 *
 * @param x
 * @param y
 * @param tolerance
 */
export function closeTo(
    x: number,
    y: number,
    tolerance: number = Number.EPSILON
): boolean {
    return Math.abs(x - y) <= tolerance
}
