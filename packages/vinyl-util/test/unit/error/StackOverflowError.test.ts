/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReportableError, StackOverflowError } from '@amazon/vinyl-util'
import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'

describe('StackOverflowError', () => {
    it('is an instance of Error and StackOverflowError', () => {
        expectPrototype(
            () => new StackOverflowError('message'),
            StackOverflowError,
            ReportableError,
            Error
        )
    })

    describe('toStringTag', () => {
        it('returns the name', () => {
            expect(new StackOverflowError('')[Symbol.toStringTag]).toBe(
                'StackOverflowError'
            )
        })
    })
})
