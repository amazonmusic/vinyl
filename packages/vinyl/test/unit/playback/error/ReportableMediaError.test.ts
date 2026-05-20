/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorLevel, ErrorOrigin } from '@amazon/vinyl-util'
import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'
import { ReportableMediaError } from '@amazon/vinyl'
import any = jasmine.any

describe('ReportableMediaError', () => {
    it('is an instance of Error and ReportableMediaError', () => {
        expectPrototype(
            () => new ReportableMediaError(null),
            ReportableMediaError,
            Error
        )
    })

    describe('constructor', () => {
        it('handles null MediaError with SILENT level', () => {
            const error = new ReportableMediaError(null)
            expect(error.level).toBe(ErrorLevel.SILENT)
            expect(error.origin).toBe(ErrorOrigin.MEDIA)
            expect(error.message).toBe('An unknown media error has occurred.')
            expect(error.reason).toBe('UNKNOWN_MEDIA_ERROR')
            expect(error.code).toBe(-1)
        })

        it('handles MEDIA_ERR_ABORTED with SILENT level', () => {
            const mediaError = { code: 1, MEDIA_ERR_ABORTED: 1 } as MediaError
            const error = new ReportableMediaError(mediaError)
            expect(error.level).toBe(ErrorLevel.SILENT)
            expect(error.code).toBe(1)
            expect(error.reason).toBe('MEDIA_ERR_ABORTED')
        })

        it('handles other media errors with FATAL level', () => {
            const mediaError = { code: 2, MEDIA_ERR_NETWORK: 2 } as MediaError
            const error = new ReportableMediaError(mediaError)
            expect(error.level).toBe(ErrorLevel.FATAL)
            expect(error.code).toBe(2)
            expect(error.reason).toBe('MEDIA_ERR_NETWORK')
        })
    })

    describe('toJSON', () => {
        it('returns a serializable error representation', () => {
            const error = new ReportableMediaError(null)
            expect(error.toJSON()).toEqual({
                name: 'ReportableMediaError',
                origin: ErrorOrigin.MEDIA,
                level: ErrorLevel.SILENT,
                message: 'An unknown media error has occurred.',
                stack: any(String),
                reason: 'UNKNOWN_MEDIA_ERROR',
                code: -1,
            })
        })
    })

    describe('toStringTag', () => {
        it('returns the name', () => {
            expect(new ReportableMediaError(null)[Symbol.toStringTag]).toBe(
                'ReportableMediaError'
            )
        })
    })

    describe('static constants', () => {
        it('defines media error constants', () => {
            expect(ReportableMediaError.MEDIA_ERR_ABORTED).toBe(1)
            expect(ReportableMediaError.MEDIA_ERR_NETWORK).toBe(2)
            expect(ReportableMediaError.MEDIA_ERR_DECODE).toBe(3)
            expect(ReportableMediaError.MEDIA_ERR_SRC_NOT_SUPPORTED).toBe(4)
        })
    })
})
