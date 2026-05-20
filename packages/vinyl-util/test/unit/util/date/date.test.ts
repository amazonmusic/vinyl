/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    parseDate,
    parseTimestamp,
    stringifyDate,
    timeDelta,
} from '@amazon/vinyl-util'

describe('date', () => {
    describe('timeDelta', () => {
        it('returns the signed time difference of two dates, in seconds', () => {
            expect(timeDelta(new Date(1200), new Date(4300))).toBe(3.1)
            expect(timeDelta(new Date(4300), new Date(1200))).toBe(-3.1)
        })
    })

    describe('parseTimestamp', () => {
        it('parses a string into a timestamp number', () => {
            expect(parseTimestamp('Wed Oct 04 2023 15:16:49 GMT-0700')).toEqual(
                1696457809000
            )
        })

        it('throws an assertion error if date is invalid', () => {
            expect(() => parseDate('invalid')).toThrowError(
                '"invalid" is an invalid date'
            )
        })
    })

    describe('parseDate', () => {
        it('parses a string into a Date object', () => {
            const d = new Date(555666)
            expect(parseDate(d.toISOString())).toEqual(d)
        })

        it('throws an assertion error if date is invalid', () => {
            expect(() => parseDate('invalid')).toThrowError(
                '"invalid" is an invalid date'
            )
        })
    })

    describe('stringifyDate', () => {
        it('returns an ISO 8601 date', () => {
            expect(stringifyDate(new Date('2023-03-06T20:31:35.419Z'))).toBe(
                '2023-03-06T20:31:35.419Z'
            )
        })
    })
})
