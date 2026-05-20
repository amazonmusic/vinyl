/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorOrigin, ValidationError } from '@amazon/vinyl-util'

import {
    parseConditionalUint,
    parseIntVector,
    parsePresentationTypeType,
    parseSap,
    parseStringVector,
    parseSwitchingTypeType,
    stringifyIntVector,
    stringifyStringVector,
} from '@amazon/vinyl-mpd-parser'

describe('dashManifestXmlRules', () => {
    describe('parseConditionalUint', () => {
        it(`correctly interprets 'true' and 'false' as boolean values`, () => {
            expect(parseConditionalUint('true')).toBeTrue()
            expect(parseConditionalUint('false')).toBeFalse()
        })
        it(`returns a numeric value for inputs other than true or false`, () => {
            expect(parseConditionalUint('0')).toBe(0)
            expect(parseConditionalUint('1')).toBe(1)
            expect(parseConditionalUint('100')).toBe(100)
        })
    })

    describe('parseStringVector', () => {
        it('dissects a string with spaces into an array of words', () => {
            expect(parseStringVector('1 2 3 4')).toEqual(['1', '2', '3', '4'])
            expect(parseStringVector('a    b  \t  c')).toEqual(['a', 'b', 'c'])
        })
    })

    describe('stringifyStringVector', () => {
        it('melds an array into a single string with spaced words', () => {
            expect(stringifyStringVector(['a', 'b', 'c'])).toBe('a b c')
        })
    })

    describe('parseIntVector', () => {
        it('decodes a space-separated string into an array of integer values', () => {
            expect(parseIntVector('1 2 3 4')).toEqual([1, 2, 3, 4])
            expect(parseIntVector('1\t\n2   \t3')).toEqual([1, 2, 3])
        })
    })

    describe('stringifyIntVector', () => {
        it('merges an array into a singular space-separated string', () => {
            expect(stringifyIntVector([1, 2, 3])).toBe('1 2 3')
        })
    })

    describe('parseSwitchingTypeType', () => {
        it('translates a string into its corresponding switching type enumeration', () => {
            expect(parseSwitchingTypeType('media')).toEqual('media')
            expect(parseSwitchingTypeType('bitstream')).toEqual('bitstream')
            expect(() => parseSwitchingTypeType('unknown')).toThrowMatching(
                (e) =>
                    e instanceof ValidationError &&
                    e.origin === ErrorOrigin.PARSING
            )
        })
    })

    describe('parsePresentationTypeType', () => {
        it('translates a string into its corresponding presentation type enumeration', () => {
            expect(parsePresentationTypeType('static')).toEqual('static')
            expect(parsePresentationTypeType('dynamic')).toEqual('dynamic')
            expect(() => parsePresentationTypeType('unknown')).toThrowMatching(
                (e) =>
                    e instanceof ValidationError &&
                    e.origin === ErrorOrigin.PARSING
            )
        })
    })

    describe('parseSap', () => {
        it('returns an integer if within 0-6 [inclusive]', () => {
            expect(parseSap('1')).toEqual(1)
            expect(parseSap('0')).toEqual(0)
            expect(parseSap('6')).toEqual(6)
            expect(() => parseSap('-1')).toThrowMatching(
                (e) =>
                    e instanceof ValidationError &&
                    e.origin === ErrorOrigin.PARSING
            )
            expect(() => parseSap('7')).toThrowMatching(
                (e) =>
                    e instanceof ValidationError &&
                    e.origin === ErrorOrigin.PARSING
            )
        })
    })
})
