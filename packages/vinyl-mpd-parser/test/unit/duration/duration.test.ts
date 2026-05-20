/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseDuration, stringifyDuration } from '@amazon/vinyl-mpd-parser'

describe('parseDuration', () => {
    it('deciphers ISO 8601 duration strings', () => {
        expect(
            parseDuration('P1.23Y454.522M0.234DT132.234H234.01M752.2001S')
        ).toBeCloseTo(
            1.23 * 365 * 24 * 3600 +
                454.522 * 30 * 24 * 3600 +
                0.234 * 24 * 3600 +
                132.234 * 3600 +
                234.01 * 60 +
                752.2001
        )
    })

    it('understands that all components within are optional', () => {
        expect(parseDuration('')).toBeCloseTo(0)

        expect(parseDuration('P1.23Y')).toBeCloseTo(1.23 * 365 * 24 * 3600)

        expect(parseDuration('P454.522M')).toBeCloseTo(454.522 * 30 * 24 * 3600)

        expect(parseDuration('P10.234D')).toBeCloseTo(10.234 * 24 * 3600)

        expect(parseDuration('PT132.234H')).toBeCloseTo(132.234 * 3600)

        expect(parseDuration('PT234.01M')).toBeCloseTo(234.01 * 60)

        expect(parseDuration('P752.2001S')).toBeCloseTo(752.2001)

        expect(parseDuration('234235S')).toBeCloseTo(234235)

        expect(parseDuration('234235.56')).toBeCloseTo(234235.56)
    })

    it('decodes potential signs present in the string', () => {
        expect(parseDuration('-T20M')).toBeCloseTo(-20 * 60)
    })

    it('raises an exception when encountering poorly structured durations', () => {
        expect(() => parseDuration('234.235.56')).toThrow()
    })
})

describe('stringifyDuration', () => {
    it('translates a duration in seconds into its ISO 8601 string format', () => {
        expect(stringifyDuration(123)).toBe('PT2M3S')
        expect(stringifyDuration(60 * 60 + 123.5)).toBe('PT1H2M3.5S')
        expect(stringifyDuration(24 * 60 * 60 + 23 * 60 * 60 + 123.5)).toBe(
            'P1DT23H2M3.5S'
        )
        expect(
            stringifyDuration(
                10 * 30 * 24 * 60 * 60 +
                    24 * 60 * 60 +
                    23 * 60 * 60 +
                    40 * 60 +
                    3.5
            )
        ).toBe('P10M1DT23H40M3.5S')
        expect(
            stringifyDuration(
                365 * 24 * 60 * 60 +
                    11 * 30 * 24 * 60 * 60 +
                    24 * 60 * 60 +
                    23 * 60 * 60 +
                    40 * 60 +
                    3.5
            )
        ).toBe('P1Y11M1DT23H40M3.5S')
    })

    it('accommodates negative durations in the translation', () => {
        expect(stringifyDuration(-143)).toBe('-PT2M23S')
        expect(stringifyDuration(-(60 * 60 + 123.5))).toBe('-PT1H2M3.5S')
        expect(
            stringifyDuration(
                -(
                    365 * 24 * 60 * 60 +
                    11 * 30 * 24 * 60 * 60 +
                    24 * 60 * 60 +
                    23 * 60 * 60 +
                    40 * 60 +
                    3.5
                )
            )
        ).toBe('-P1Y11M1DT23H40M3.5S')
    })

    it(`ensures there's at least one component present in the result`, () => {
        expect(stringifyDuration(10 * 365 * 24 * 60 * 60)).toBe('P10YT')
        expect(stringifyDuration(5 * 60)).toBe('PT5M')
        expect(stringifyDuration(0)).toBe('PT0S')
    })
})
