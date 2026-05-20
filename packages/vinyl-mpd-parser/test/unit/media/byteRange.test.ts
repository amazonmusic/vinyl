/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin, ValidationError } from '@amazon/vinyl-util'
import { parseByteRange, stringifyByteRange } from '@amazon/vinyl-mpd-parser'

describe('parseByteRange', () => {
    it('returns a two element array representing the byte range', () => {
        expect(parseByteRange('1-2')).toEqual([1, 2])
        expect(parseByteRange('0-99')).toEqual([0, 99])
        expect(parseByteRange('123-345')).toEqual([123, 345])
    })

    it('allows for an open-ended range', () => {
        expect(parseByteRange('1-')).toEqual([1, null])
    })

    it('throws if not formatted correctly', () => {
        const expectedError = (e: Error) =>
            e instanceof ValidationError && e.origin === ErrorOrigin.PARSING
        expect(() => parseByteRange('123')).toThrowMatching(expectedError)
        expect(() => parseByteRange(undefined as any)).toThrowMatching(
            expectedError
        )
    })

    it('handles negative ranges', () => {
        expect(parseByteRange('1-1')).toEqual([1, 1])
        expect(parseByteRange('2147483647--2147483648')).toEqual([
            0x7fffffff, 0x80000000,
        ])
        expect(parseByteRange('-2147483648--2147483647')).toEqual([
            0x80000000, 0x80000001,
        ])
        expect(parseByteRange('-2147483646--1')).toEqual([
            0x80000002, 0xffffffff,
        ])
    })

    it('handles up to 53 bit ranges', () => {
        expect(parseByteRange('5000000000-5000000001')).toEqual([
            5000000000, 5000000001,
        ])
    })
})

describe('stringifyByteRange', () => {
    it('generates a string from a byte-range tuple', () => {
        expect(stringifyByteRange([1, 2])).toBe('1-2')
        expect(stringifyByteRange([123, 456])).toBe('123-456')
    })

    it('allows for an open-ended range', () => {
        expect(stringifyByteRange([123, null])).toBe('123-')
    })
})
