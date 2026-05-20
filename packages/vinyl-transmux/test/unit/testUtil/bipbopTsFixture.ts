/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { base64ToByteArray } from '@amazon/vinyl-util'
import { bipbopTsSegmentBase64 } from './bipbopTsBase64'

/**
 * Decodes the base64 bipbop TS fixture into a Uint8Array.
 */
export function decodeBipbopTsSegment(): Uint8Array {
    return base64ToByteArray(bipbopTsSegmentBase64)
}
