/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { DrmError } from '@amazon/vinyl'
import { ErrorLevel, ErrorOrigin, ReportableError } from '@amazon/vinyl-util'
import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'
import objectContaining = jasmine.objectContaining
import any = jasmine.any

describe('DrmError', () => {
    it('is an instance of Error and DrmError', () => {
        expectPrototype(
            () => new DrmError(''),
            DrmError,
            ReportableError,
            Error
        )
    })

    it('is fatal by default', () => {
        expect(new DrmError('').level).toBe(ErrorLevel.FATAL)
        expect(
            new DrmError('', {}, ErrorOrigin.UNCAUGHT, ErrorLevel.WARN).level
        ).toBe(ErrorLevel.WARN)
    })

    describe('toStringTag', () => {
        it('returns the name', () => {
            expect(new DrmError('')[Symbol.toStringTag]).toBe('DrmError')
        })
    })

    describe('toJSON', () => {
        it('provides a serializable representation', () => {
            expect(
                new DrmError(
                    'message',
                    { keySystem: 'myKeySystem' },
                    ErrorOrigin.DRM,
                    ErrorLevel.SILENT
                ).toJSON()
            ).toEqual(
                objectContaining({
                    message: 'message',
                    extra: { keySystem: 'myKeySystem' },
                    stack: any(String),
                    origin: ErrorOrigin.DRM,
                    level: ErrorLevel.SILENT,
                })
            )
        })
    })
})
