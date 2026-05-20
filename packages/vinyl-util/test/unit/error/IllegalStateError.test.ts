/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { IllegalStateError, ReportableError } from '@amazon/vinyl-util'
import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'

describe('IllegalStateError', () => {
    it('is an instance of Error and IllegalStateError', () => {
        expectPrototype(
            () => new IllegalStateError('message'),
            IllegalStateError,
            ReportableError,
            Error
        )
    })

    describe('toStringTag', () => {
        it('returns the name', () => {
            expect(new IllegalStateError('')[Symbol.toStringTag]).toBe(
                'IllegalStateError'
            )
        })
    })
})
