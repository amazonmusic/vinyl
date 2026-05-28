/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Maybe } from '../type'

/**
 * Returns true if the given string is 'true' or '1'
 *
 * @param str
 */
export function parseBoolean(str: Maybe<string>): boolean {
    return str === 'true' || str === '1'
}

/**
 * Returns the toString() value of the given object.
 *
 * @param value
 */
export function stringify(value: any): string {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    return value.toString()
}

/**
 * Parses a string into an integer.
 * If the string is nullish, empty, or is not a finite number, returns null.
 */
export function parseIntSafe(
    str: Maybe<string>,
    radix?: number
): number | null {
    if (!str) return null
    const value = parseInt(str, radix)
    if (!Number.isFinite(value)) return null
    return value
}

/**
 * Parses a string into a number.
 * If the string is nullish, empty, or is not a finite number, returns null.
 */
export function parseFloatSafe(str: Maybe<string>): number | null {
    if (!str) return null
    const value = parseFloat(str)
    if (!Number.isFinite(value)) return null
    return value
}
