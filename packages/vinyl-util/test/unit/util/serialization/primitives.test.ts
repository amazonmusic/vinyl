/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    parseBoolean,
    parseFloatSafe,
    parseIntSafe,
    stringify,
} from '@amazon/vinyl-util'

describe('primitives', () => {
    describe('parseBoolean', () => {
        it('parses a string into a boolean', () => {
            expect(parseBoolean('1')).toBeTrue()
            expect(parseBoolean('true')).toBeTrue()
            expect(parseBoolean('false')).toBeFalse()
            expect(parseBoolean('0')).toBeFalse()
            expect(parseBoolean(null)).toBeFalse()
            expect(parseBoolean(undefined)).toBeFalse()
        })
    })

    describe('stringify', () => {
        it('toStrings a value', () => {
            expect(stringify(3)).toBe('3')
            expect(stringify(true)).toBe('true')
            expect(stringify(null)).toBe('null')
            expect(stringify(undefined)).toBe('undefined')
        })
    })

    describe('parseIntSafe', () => {
        it('parses a string into an integer', () => {
            expect(parseIntSafe('3')).toEqual(3)
            expect(parseIntSafe('3.3')).toEqual(3)
            expect(parseIntSafe('0xff', 16)).toEqual(255)
            expect(parseIntSafe(null)).toEqual(null)
            expect(parseIntSafe(undefined)).toEqual(null)
            expect(parseIntSafe('NaN')).toEqual(null)
            expect(parseIntSafe('Infinity')).toEqual(null)
            expect(parseIntSafe(null, 16)).toEqual(null)
        })
    })

    describe('parseFloatSafe', () => {
        it('parses a string into a number', () => {
            expect(parseFloatSafe('3')).toEqual(3)
            expect(parseFloatSafe('3.3')).toEqual(3.3)
            expect(parseFloatSafe(null)).toEqual(null)
            expect(parseFloatSafe(undefined)).toEqual(null)
            expect(parseFloatSafe('NaN')).toEqual(null)
            expect(parseFloatSafe('Infinity')).toEqual(null)
        })
    })
})
