/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { mediaErrorToJson } from '@amazon/vinyl'
import { MockMediaError } from '@amazon/vinyl-util/browserTestUtil'

describe('mediaErrorToJson', () => {
    it('produces a serializable format of a MediaError', () => {
        const error = new MockMediaError()
        error.code = error.MEDIA_ERR_ABORTED
        expect(mediaErrorToJson(error)).toEqual({
            message:
                "The requesting of the associated resource was aborted by the user's request.",
            code: 1,
            name: 'MEDIA_ERR_ABORTED',
        })
        error.code = error.MEDIA_ERR_NETWORK
        expect(mediaErrorToJson(error)).toEqual({
            message: 'A network error occurred.',
            code: 2,
            name: 'MEDIA_ERR_NETWORK',
        })
        error.code = error.MEDIA_ERR_DECODE
        expect(mediaErrorToJson(error)).toEqual({
            message:
                'An error occurred while trying to decode the media resource.',
            code: 3,
            name: 'MEDIA_ERR_DECODE',
        })
        error.code = error.MEDIA_ERR_SRC_NOT_SUPPORTED
        expect(mediaErrorToJson(error)).toEqual({
            message: 'The associated resource was not supported.',
            code: 4,
            name: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
        })

        expect(mediaErrorToJson(null)).toEqual({
            message: 'An unknown media error has occurred.',
            code: -1,
            name: 'UNKNOWN_MEDIA_ERROR',
        })

        error.code = 5
        expect(mediaErrorToJson(error)).toEqual({
            message: 'An unknown media error has occurred.',
            code: 5,
            name: 'UNKNOWN_MEDIA_ERROR',
        })
    })
})
