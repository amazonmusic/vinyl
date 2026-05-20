/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createDrmErrorHandler, DrmError } from '@amazon/vinyl'
import { ErrorLevel } from '@amazon/vinyl-util'
import objectContaining = jasmine.objectContaining

describe('createDrmErrorHandler', () => {
    it('returns a function to wrap a provided Error object in a DrmError', () => {
        const handler = createDrmErrorHandler()
        expect(() => handler(new Error('expected'))).toThrowError(
            DrmError,
            'expected'
        )

        expect(() => handler(new Error('expected'))).toThrowMatching(
            (drmError: DrmError) => {
                expect(drmError.toJSON()).toEqual(
                    objectContaining({
                        extra: {
                            error: objectContaining({
                                message: 'expected',
                            }),
                        },
                    })
                )
                return drmError.level === ErrorLevel.FATAL
            }
        )
    })
})
