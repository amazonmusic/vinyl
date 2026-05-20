/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseIntSafe } from '@amazon/vinyl-util'
import { throwParsingError } from '@/error/parsingError'

/**
 * A range of bytes, [from, to (optional, inclusive)].
 */
export type ByteRange = readonly [number, number | null]

const byteRangeExp = /^(-?[0-9]+)-(-?[0-9]*)$/

export function parseByteRange(str: string): ByteRange {
    const match = str ? byteRangeExp.exec(str) : null
    if (!match) throwParsingError(`invalid byte range: '${str}'`)
    let start = parseInt(match[1])
    // Convert possibly-negative Int32 overflow value to its Uint32 equivalent
    // (reinterpret 32-bit signed integer bits as unsigned)
    if (start < 0) start >>>= 0
    let end = parseIntSafe(match[2])
    if (end != null && end < 0) end = end >>> 0
    return [start, end]
}

/**
 * Returns the string representation of a {@link ByteRange} value.
 *
 * @param value
 */
export function stringifyByteRange(value: ByteRange): string {
    const end = value[1]
    return `${value[0]}-${end == null ? '' : end}`
}
