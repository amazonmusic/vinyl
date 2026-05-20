/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin, ValidationError } from '@amazon/vinyl-util'
import { parseRatio, stringifyRatio } from '@amazon/vinyl-mpd-parser'

describe('parseRatio', () => {
    it('returns a two element array representing the ratio', () => {
        expect(parseRatio('4:3')).toEqual([4, 3])
        expect(parseRatio('16:9')).toEqual([16, 9])
        expect(parseRatio(':')).toEqual([1, 1])
    })

    it('throws an error for malformed ratio strings', () => {
        const expectedError = (e: Error) =>
            e instanceof ValidationError && e.origin === ErrorOrigin.PARSING
        expect(() => parseRatio('')).toThrowMatching(expectedError)
        expect(() => parseRatio('a4:3')).toThrowMatching(expectedError)
        expect(() => parseRatio('4:3a')).toThrowMatching(expectedError)
        expect(() => parseRatio(undefined as any)).toThrowMatching(
            expectedError
        )
    })
})

describe('stringifyRatio', () => {
    it('returns a string of first element colon second element', () => {
        expect(stringifyRatio([4, 3])).toBe('4:3')
        expect(stringifyRatio([1, 2])).toBe('1:2')
    })
})
