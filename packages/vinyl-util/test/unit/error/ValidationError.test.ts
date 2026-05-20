/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ErrorLevel,
    ErrorOrigin,
    ReportableError,
    ValidationError,
} from '@amazon/vinyl-util'
import { expectPrototype } from '@amazon/vinyl-util/browserTestUtil'
import any = jasmine.any

describe('ValidationError', () => {
    it('is an instance of Error', () => {
        expectPrototype(
            () => new ValidationError('message', ErrorOrigin.API, []),
            ValidationError,
            ReportableError,
            Error
        )
    })

    describe('constructor', () => {
        it('accepts an error origin and path', () => {
            const e = new ValidationError('', ErrorOrigin.INTERNAL, [
                'pathA',
                'pathB',
            ])
            expect(e.origin).toBe(ErrorOrigin.INTERNAL)
            expect(e.path).toEqual(['pathA', 'pathB'])

            const e2 = new ValidationError('')
            expect(e2.origin).toBe(ErrorOrigin.API)
            expect(e2.path).toEqual([])
        })
    })

    describe('toJSON', () => {
        it('includes all properties', () => {
            const e = new ValidationError('message', ErrorOrigin.INTERNAL, [
                'pathA',
                'pathB',
            ])
            expect(e.toJSON()).toEqual({
                message: 'message',
                name: 'ValidationError',
                path: ['pathA', 'pathB'],
                origin: ErrorOrigin.INTERNAL,
                level: ErrorLevel.FATAL,
                stack: any(String),
            })
        })
    })
})
