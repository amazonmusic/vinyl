/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'
import { InvalidSeekError } from '@amazon/vinyl'
import {
    emptyRanges,
    ErrorLevel,
    ErrorOrigin,
    ReportableError,
} from '@amazon/vinyl-util'
import { rangesOf } from '@amazon/vinyl-util'
import any = jasmine.any

describe('InvalidSeekError', () => {
    it('is an instance of Error and InvalidSeekError', () => {
        expectPrototype(
            () => new InvalidSeekError(1, emptyRanges, 1),
            InvalidSeekError,
            ReportableError,
            Error
        )
    })

    describe('toJSON', () => {
        it('adds time and seekable ranges', () => {
            expect(
                new InvalidSeekError(
                    3,
                    rangesOf([
                        [1, 4],
                        [6, 8],
                    ]),
                    1
                ).toJSON()
            ).toEqual({
                name: 'InvalidSeekError',
                message:
                    'Could not seek to time: 3, outside of seekable ranges [[1, 4], [6, 8]] with tolerance 1',
                time: 3,
                level: ErrorLevel.WARN,
                origin: ErrorOrigin.API,
                seekable: [
                    [1, 4],
                    [6, 8],
                ],
                stack: any(String),
            })
        })
    })

    describe('toStringTag', () => {
        it('returns the name', () => {
            expect(
                new InvalidSeekError(1, emptyRanges, 1)[Symbol.toStringTag]
            ).toBe('InvalidSeekError')
        })
    })
})
