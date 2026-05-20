/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReportableError, TimeoutError } from '@amazon/vinyl-util'
import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'

describe('TimeoutError', () => {
    it('is an instance of Error and TimeoutError', () => {
        expectPrototype(
            () => new TimeoutError('message'),
            TimeoutError,
            ReportableError,
            Error
        )
    })

    describe('toStringTag', () => {
        it('returns the name', () => {
            expect(new TimeoutError('')[Symbol.toStringTag]).toBe(
                'TimeoutError'
            )
        })
    })
})
