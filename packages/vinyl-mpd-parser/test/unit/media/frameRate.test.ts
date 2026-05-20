/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin, ValidationError } from '@amazon/vinyl-util'
import { parseFrameRate, stringifyFrameRate } from '@amazon/vinyl-mpd-parser'

describe('parseFrameRate', () => {
    it('returns a two element array representing the frame rate', () => {
        expect(parseFrameRate('24000/1001')).toEqual([24000, 1001])
        expect(parseFrameRate('30')).toEqual([30, 1])
        expect(parseFrameRate('30000/1001')).toEqual([30000, 1001])
    })

    it('throws an exception for incorrectly structured frame rate strings', () => {
        const expectedError = (e: Error) =>
            e instanceof ValidationError && e.origin === ErrorOrigin.PARSING
        expect(() => parseFrameRate('')).toThrowMatching(expectedError)
        expect(() => parseFrameRate('/')).toThrowMatching(expectedError)
        expect(() => parseFrameRate('a4/3')).toThrowMatching(expectedError)
        expect(() => parseFrameRate('4/3a')).toThrowMatching(expectedError)
        expect(() => parseFrameRate(undefined as any)).toThrowMatching(
            expectedError
        )
    })
})

describe('stringifyFrameRate', () => {
    it('produces a "first element/second" formatted string', () => {
        expect(stringifyFrameRate([30, 6])).toBe('30/6')
    })

    it('generates a string of just the first element if the second equals one', () => {
        expect(stringifyFrameRate([30, 1])).toBe('30')
    })
})
