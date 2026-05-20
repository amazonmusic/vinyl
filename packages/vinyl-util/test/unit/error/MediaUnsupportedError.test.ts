/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MediaUnsupportedError, ReportableError } from '@amazon/vinyl-util'
import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'
import objectContaining = jasmine.objectContaining

describe('MediaUnsupportedError', () => {
    it('is an instance of Error and MediaUnsupportedError', () => {
        expectPrototype(
            () => new MediaUnsupportedError('message', 'code'),
            MediaUnsupportedError,
            ReportableError,
            Error
        )
    })

    describe('toJson', () => {
        it('includes code', () => {
            expect(
                new MediaUnsupportedError('message', 'code').toJSON()
            ).toEqual(
                objectContaining({
                    code: 'code',
                    message: 'message',
                })
            )
        })
    })

    describe('toStringTag', () => {
        it('returns the name', () => {
            expect(
                new MediaUnsupportedError('', 'code')[Symbol.toStringTag]
            ).toBe('MediaUnsupportedError')
        })
    })
})
