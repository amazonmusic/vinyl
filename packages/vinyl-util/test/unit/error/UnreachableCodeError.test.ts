/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReportableError, UnreachableCodeError } from '@amazon/vinyl-util'
import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'

describe('UnreachableCodeError', () => {
    it('is an instance of Error and UnreachableCodeError', () => {
        expectPrototype(
            () => new UnreachableCodeError(),
            UnreachableCodeError,
            ReportableError,
            Error
        )
    })

    describe('toStringTag', () => {
        it('returns the name', () => {
            expect(new UnreachableCodeError()[Symbol.toStringTag]).toBe(
                'UnreachableCodeError'
            )
        })
    })
})
