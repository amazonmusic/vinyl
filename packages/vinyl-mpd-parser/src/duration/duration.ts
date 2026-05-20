/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ErrorOrigin,
    roundToNearest,
    ValidationError,
} from '@amazon/vinyl-util'

// ESBuild (https://github.com/evanw/esbuild/issues/3988) considers multiplication and division
// to have a side effect and will inhibit tree shaking.
// E.g. H = 60 * 60 will not be removed when not referenced.
const I = 60
const H = 3600
const D = 86400
const M = 2592000
const Y = 31536000

/**
 * A duration, in seconds. (This may be negative)
 */
export type Duration = number

/**
 * https://www.w3.org/TR/xmlschema-2/#duration
 */
const iso8601Duration =
    /^(-?)P?(\d+(?:\.\d*)?Y)?(\d+(?:\.\d*)?M)?(\d+(?:\.\d*)?D)?T?(\d+(?:\.\d*)?H)?(\d+(?:\.\d*)?M)?(\d+(?:\.\d*)?S?)?$/i

/**
 * Parses an ISO 8601 duration into seconds.
 * The accepted format is P(n)Y(n)M(n)DT(n)H(n)M(n)S
 *
 * All units shall have a fixed size.
 *
 * P - Period designator, precedes all durations.
 * 1Y (Year) = 365 * 24 * 60 * 60 Seconds
 * 1M (Month) = 30 * 24 * 60 * 60 Seconds
 * 1D (Day) = 24 * 60 * 60 Seconds
 *
 * T - Time designator, precedes all time components.
 * 1H (Hour) = 60 * 60 Seconds
 * 1M (Minute) = 60 Seconds
 * 1S (Second)
 *
 *
 * @param value
 * @return Returns the duration in seconds or throws an {@link ValidationError}
 * if not properly formatted.
 * @see https://www.w3.org/TR/xmlschema-2/#duration
 */
export function parseDuration(value: string): Duration {
    const match = iso8601Duration.exec(value)
    if (match == null)
        throw new ValidationError(
            `Unexpected duration: '${value}', should be in iso 8601 format`,
            ErrorOrigin.PARSING
        )

    const sign = match[1] === '-' ? -1 : 1
    return (
        sign *
        (parseFloat(match[2] || '0') * Y +
            parseFloat(match[3] || '0') * M +
            parseFloat(match[4] || '0') * D +
            parseFloat(match[5] || '0') * H +
            parseFloat(match[6] || '0') * I +
            parseFloat(match[7] || '0'))
    )
}

/**
 * Returns the iso 8601 string representation of a duration value.
 *
 * @param value A duration value, in seconds.
 */
export function stringifyDuration(value: Duration): string {
    const sign = value < 0 ? '-' : ''
    let abs = Math.abs(value)

    const years = Math.floor(abs / Y)
    abs -= years * Y
    const months = Math.floor((abs % Y) / M)
    const days = Math.floor((abs % M) / D)
    const hours = Math.floor((abs % D) / H)
    const minutes = Math.floor((abs % H) / I)
    const seconds = abs % I
    let isoString = `${sign}P`
    if (years > 0) isoString += `${years}Y`
    if (months > 0) isoString += `${months}M`
    if (days > 0) isoString += `${days}D`
    isoString += 'T'
    if (hours > 0) isoString += `${hours}H`
    if (minutes > 0) isoString += `${minutes}M`
    if (seconds > 0 || !value) isoString += `${roundToNearest(seconds, 0.001)}S`
    return isoString
}
