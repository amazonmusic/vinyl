/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ErrorOrigin,
    IllegalArgumentError,
    ReportableError,
} from '@amazon/vinyl-util'
import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'

describe('IllegalArgumentError', () => {
    it('is an instance of Error and IllegalArgumentError', () => {
        expectPrototype(
            () => new IllegalArgumentError('message'),
            IllegalArgumentError,
            ReportableError,
            Error
        )
    })

    describe('origin', () => {
        describe('when isInternal is true', () => {
            it('returns INTERNAL', () => {
                expect(new IllegalArgumentError('').origin).toBe(
                    ErrorOrigin.INTERNAL
                )
                expect(new IllegalArgumentError('', true).origin).toBe(
                    ErrorOrigin.INTERNAL
                )
            })
        })

        describe('when isInternal is false', () => {
            it('returns API', () => {
                expect(new IllegalArgumentError('', false).origin).toBe(
                    ErrorOrigin.API
                )
            })
        })
    })

    describe('toStringTag', () => {
        it('returns the name', () => {
            expect(new IllegalArgumentError('')[Symbol.toStringTag]).toBe(
                'IllegalArgumentError'
            )
        })
    })
})
