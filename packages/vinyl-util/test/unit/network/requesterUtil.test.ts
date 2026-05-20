/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Timestamp } from '@amazon/vinyl-util'
import {
    getResponseInfo,
    parseRetryAfter,
    retryAfterJitter,
    shouldRetry,
} from '@amazon/vinyl-util'
import { useMockTime } from '@amazon/vinyl-util/browserTestUtil'
import { useMockLogger } from '@amazon/vinyl-util/testUtil'

describe('responseUtil', () => {
    const loggerRef = useMockLogger()
    describe('shouldRetry', () => {
        it('returns true for 429, 503, and 504 responses', () => {
            expect(shouldRetry(429)).toBeTrue()
            expect(shouldRetry(503)).toBeTrue()
            expect(shouldRetry(504)).toBeTrue()
        })

        it('returns false for other responses', () => {
            expect(shouldRetry(418)).toBeFalse()
            expect(shouldRetry(500)).toBeFalse()
            expect(shouldRetry(501)).toBeFalse()
            expect(shouldRetry(550)).toBeFalse()
            expect(shouldRetry(599)).toBeFalse()
        })
    })

    describe('parseRetryAfter', () => {
        describe('when value is numeric', () => {
            const time = useMockTime()
            it('returns now + seconds', () => {
                time.mockDate(new Date(456))
                expect(parseRetryAfter('123')).toBe(456 + 123 * 1000)
                expect(parseRetryAfter('0')).toBe(456)
                expect(parseRetryAfter('6543210')).toBe(456 + 6543210 * 1000)
            })
        })

        describe('when value is nullish', () => {
            it('returns nullish', () => {
                expect(parseRetryAfter(null)).toBeNull()
                expect(parseRetryAfter(undefined)).toBeNull()
            })
        })

        describe('when Retry-After header is invalid', () => {
            it('returns null', () => {
                expect(parseRetryAfter('invalid')).toBe(null)
            })

            it('logs a warning', () => {
                parseRetryAfter('invalid')
                expect(loggerRef.value.log).toHaveBeenCalledTimes(1)
            })
        })

        describe('when Retry-After header is an HTTP-Date', () => {
            it('returns a timestamp', () => {
                // RFC-1123
                const str = new Date(
                    parseRetryAfter('Sun, 21 Oct 2018 12:16:24 GMT')!
                ).toISOString()
                expect(str).toBe('2018-10-21T12:16:24.000Z')

                // RFC-850
                // Note that some older browsers (e.g. Firefox 26) do not support parsing RFC-850
                // dates. RFC-850 and asctime are considered deprecated formats.
                // Instead of adding support for this extreme edge case, just test that the retry-after
                // gracefully results in null.
                const fullYear = new Date().getFullYear()
                const twoDigitYear = fullYear.toString().substring(2)
                expect([null, `${fullYear}-11-06T08:49:37.000Z`]).toContain(
                    toIsoString(
                        parseRetryAfter(
                            `Sunday, 06-Nov-${twoDigitYear} 08:49:37 GMT`
                        )
                    )
                )

                // asctime
                expect(
                    toIsoString(parseRetryAfter('Sun Nov 6 08:49:37 1994'))
                ).toBe('1994-11-06T08:49:37.000Z')
                expect(
                    toIsoString(parseRetryAfter('Sat Dec 13 18:12:00 2024'))
                ).toBe('2024-12-13T18:12:00.000Z')
            })
        })
    })

    describe('getResponseInfo', () => {
        it('copies response properties', () => {
            const r = new Response('', {
                status: 201,
                statusText: 'abc',
                headers: {
                    'content-length': '100',
                },
            })
            expect(getResponseInfo(r)).toEqual({
                ok: true,
                redirected: false,
                status: 201,
                statusText: 'abc',
                type: r.type,
                url: r.url,
                contentLength: 100,
            })
        })
    })

    describe('retryAfterJitter', () => {
        it('returns between 0 and 90', () => {
            const randomSpy = spyOn(Math, 'random')
            randomSpy.and.returnValue(0)
            expect(retryAfterJitter()).toBe(0)
            randomSpy.and.returnValue(1)
            expect(retryAfterJitter()).toBe(90)
        })
    })
})

function toIsoString(timestamp: Timestamp | null): string | null {
    if (timestamp == null) return null
    return new Date(timestamp).toISOString()
}
