/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    AbortError,
    ErrorLevel,
    ErrorOrigin,
    ReportableError,
} from '@amazon/vinyl-util'
import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'

describe('AbortError', () => {
    it('is an instance of Error and AbortError', () => {
        expectPrototype(
            () => new AbortError(),
            AbortError,
            ReportableError,
            Error
        )
    })

    it('is silent by default', () => {
        expect(new AbortError().level).toBe(ErrorLevel.SILENT)
        expect(
            new AbortError('', ErrorOrigin.UNCAUGHT, ErrorLevel.WARN).level
        ).toBe(ErrorLevel.WARN)
    })

    describe('toStringTag', () => {
        it('returns the name', () => {
            expect(new AbortError('')[Symbol.toStringTag]).toBe('AbortError')
        })
    })
})
