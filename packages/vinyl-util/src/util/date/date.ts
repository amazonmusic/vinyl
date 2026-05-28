/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin } from '../../error/ErrorOrigin'
import type { ReadonlyDate } from '../object/readonlyType'
import { substitute } from '../string/string'
import { ValidationError } from '../../error/ValidationError'

/**
 * @private
 */
const locale = {
    invalidDateError: `"{value}" is an invalid date`,
} as const

/**
 * Returns the signed time difference of end - start, in seconds.
 *
 * @param start The beginning date
 * @param end The later date
 */
export function timeDelta(start: ReadonlyDate, end: ReadonlyDate): number {
    return (end.getTime() - start.getTime()) / 1000
}

/**
 * A type alias to clarify that a number represents a unix timestamp
 * (milliseconds from 1970-1-1 00:00).
 */
export type Timestamp = number

/**
 * Parses a string into a unix Timestamp using `Date.parse`, if the date is invalid, throws a
 * `ValidationError`
 * @param str
 */
export function parseTimestamp(str: string): Timestamp {
    const timestamp = Date.parse(str)
    if (Number.isNaN(timestamp))
        throw new ValidationError(
            substitute(locale.invalidDateError, { value: str }),
            ErrorOrigin.PARSING
        )
    return timestamp
}

/**
 * Parses a string into a date using `Date.parse`, if the date is invalid, throws a
 * `ValidationError`
 * @param str
 */
export function parseDate(str: string): Date {
    return new Date(parseTimestamp(str))
}

/**
 * Returns the iso 8601 string representation of a `Date` value.
 *
 * @param value
 */
export function stringifyDate(value: ReadonlyDate): string {
    return value.toISOString()
}
