/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { throwParsingError } from '@/error/parsingError'

/**
 * A numerator and denominator.
 */
export type Ratio = readonly [number, number]

/**
 * The XSD specifies `[0-9]*`, and not `[0-9]+`, which would match `'23:'`
 * For missing dimensions, default to 1.
 */
const ratioRegExp = /^([0-9]*):([0-9]*)$/

/**
 * Parses a string representing a ratio into [number, number].
 * The string must satisfy the pattern: `/^([0-9]*):([0-9]*)$/`
 * Examples:
 * ```
 * parseRatio('4:3') // [4, 3]
 * parseRatio('16:9') // [16, 9]
 * parseRatio('2:') // [2, 1]
 * ```
 *
 * @private
 */
export function parseRatio(str: string): Ratio {
    const match = str ? ratioRegExp.exec(str) : null
    if (!match) throwParsingError(`invalid ratio format: ${str}`)
    return [parseInt(match[1] || '1'), parseInt(match[2] || '1')]
}

/**
 * Returns the string representation of a {@link Ratio} value.
 *
 * @param value
 */
export function stringifyRatio(value: Ratio): string {
    return `${value[0]}:${value[1]}`
}
