/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    CommonMediaKeySessionError,
    MediaKeySessionErrorType,
} from '@amazon/vinyl'
import { ErrorLevel, ErrorOrigin } from '@amazon/vinyl-util'
import any = jasmine.any

describe('CommonEme', () => {
    describe('CommonMediaKeySessionError', () => {
        it('returns a serializable error representation', () => {
            const code = 0
            const systemCode = 0
            expect(
                new CommonMediaKeySessionError(
                    code,
                    MediaKeySessionErrorType.CLIENT,
                    systemCode,
                    MediaKeySessionErrorType.CLIENT
                ).toJSON()
            ).toEqual({
                name: 'CommonMediaKeySessionError',
                origin: ErrorOrigin.DRM,
                level: ErrorLevel.WARN,
                message: MediaKeySessionErrorType.CLIENT,
                stack: any(String),
                code,
                codeStr: MediaKeySessionErrorType.CLIENT,
                systemCode,
                systemCodeStr: MediaKeySessionErrorType.CLIENT,
            })
        })
    })
})
