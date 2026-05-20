/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ErrorLevel,
    ErrorOrigin,
    isReportableError,
    isSilentError,
    ReportableError,
} from '@amazon/vinyl-util'
import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'
import any = jasmine.any

describe('ReportableError', () => {
    it('is an instance of Error and ReportableError', () => {
        expectPrototype(
            () => new ReportableError('message'),
            ReportableError,
            Error
        )
    })

    describe('toJSON', () => {
        it('returns a serializable error representation', () => {
            expect(new ReportableError('message').toJSON()).toEqual({
                name: 'ReportableError',
                origin: ErrorOrigin.INTERNAL,
                level: ErrorLevel.FATAL,
                message: 'message',
                stack: any(String),
            })
        })
    })

    describe('origin', () => {
        it('returns INTERNAL', () => {
            expect(new ReportableError('').origin).toBe(ErrorOrigin.INTERNAL)
        })
    })

    describe('toStringTag', () => {
        it('returns the name', () => {
            expect(new ReportableError()[Symbol.toStringTag]).toBe(
                'ReportableError'
            )
        })
    })
})

describe('isReportableError', () => {
    it('returns true if the error is a ReportableError', () => {
        expect(isReportableError(new ReportableError(''))).toBeTrue()
        expect(isReportableError(new Error(''))).toBeFalse()

        const e2 = new Error('')
        ;(e2 as any).origin = ErrorOrigin.INTERNAL
        expect(isReportableError(e2)).toBeFalse()
    })
})

describe('isSilentError', () => {
    it('returns true if the error is level SILENT', () => {
        expect(
            isSilentError(new ReportableError('', '', ErrorLevel.SILENT))
        ).toBeTrue()
        expect(isSilentError(new ReportableError(''))).toBeFalse()
        expect(
            isSilentError(new ReportableError('', ErrorLevel.WARN))
        ).toBeFalse()
    })
})
