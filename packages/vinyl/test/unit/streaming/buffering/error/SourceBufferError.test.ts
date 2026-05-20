/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'
import { SourceBufferError } from '@amazon/vinyl'

import { ReportableError } from '@amazon/vinyl-util'

describe('SourceBufferError', () => {
    it('is an instance of Error and SourceBufferError', () => {
        expectPrototype(
            () => new SourceBufferError(),
            SourceBufferError,
            ReportableError,
            Error
        )
    })

    describe('toStringTag', () => {
        it('returns the name', () => {
            expect(new SourceBufferError()[Symbol.toStringTag]).toBe(
                'SourceBufferError'
            )
        })
    })
})
