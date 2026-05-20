/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { throwParsingError } from '@/error/parsingError'

export type FrameRate = readonly [number, number]

const framerateRegexp = /^(\d+)(?:\/(\d+))?$/

/**
 * Parses a string into a {@link FrameRate}
 *
 * @private
 */
export function parseFrameRate(str: string): FrameRate {
    const match = str ? framerateRegexp.exec(str) : null
    if (!match) throwParsingError(`invalid frame rate: '${str}'`)
    return [parseInt(match[1]), parseInt(match[2] || '1')]
}

/**
 * Returns the string representation of a {@link FrameRate} value.
 *
 * @param value
 */
export function stringifyFrameRate(value: FrameRate): string {
    return value[1] === 1 ? value[0].toString() : `${value[0]}/${value[1]}`
}
