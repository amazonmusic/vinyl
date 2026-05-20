/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ValidationError } from '@amazon/vinyl-util'
import { ErrorOrigin } from '@amazon/vinyl-util'
import { bufferToUtf16 } from '@amazon/vinyl-util'

/**
 * Extract contentId from event data encoded as UTF16.
 *
 * @param initData Expected byte array representing a UTF-16 string in the form
 * `skd://0b5689bb-4171-97e5-c280-99f7abe4004f`
 */
export function extractContentId(initData: Uint8Array): string {
    const bufferStr = bufferToUtf16(initData.buffer)
    const matches = bufferStr.match(/skd:\/\/(.+)$/)
    if (!matches) {
        throw new ValidationError('No contentId match', ErrorOrigin.MEDIA)
    }
    return matches[1]
}
