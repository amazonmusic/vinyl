/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { BufferError, ReportableError } from '@amazon/vinyl-util'
import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'

describe('BufferError', () => {
    it('is an instance of Error and BufferError', () => {
        expectPrototype(
            () => new BufferError('message'),
            BufferError,
            ReportableError,
            Error
        )
    })

    describe('toStringTag', () => {
        it('returns the name', () => {
            expect(new BufferError('')[Symbol.toStringTag]).toBe('BufferError')
        })
    })
})
