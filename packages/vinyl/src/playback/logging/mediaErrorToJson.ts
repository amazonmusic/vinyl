/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Maybe } from '@amazon/vinyl-util'

export function mediaErrorToJson(error: Maybe<MediaError>): {
    readonly name: string
    readonly message: string
    readonly code: number
} {
    let message: string = 'An unknown media error has occurred.'
    let name: string = 'UNKNOWN_MEDIA_ERROR'
    let code = -1
    if (error) {
        code = error.code
        switch (error.code) {
            case error.MEDIA_ERR_ABORTED: {
                message = `The requesting of the associated resource was aborted by the user's request.`
                name = 'MEDIA_ERR_ABORTED'
                break
            }
            case error.MEDIA_ERR_NETWORK: {
                message = 'A network error occurred.'
                name = 'MEDIA_ERR_NETWORK'
                break
            }
            case error.MEDIA_ERR_DECODE: {
                name = 'MEDIA_ERR_DECODE'
                message =
                    'An error occurred while trying to decode the media resource.'
                break
            }
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED: {
                name = 'MEDIA_ERR_SRC_NOT_SUPPORTED'
                message = 'The associated resource was not supported.'
                break
            }
        }
    }
    return {
        name,
        message,
        code,
    }
}
