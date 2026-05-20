/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Base64BinaryType } from '@amazon/vinyl-xml'

/**
 * Cenc content protection xml types.
 *
 * @see https://github.com/sannies/rtp2dash/blob/master/src/main/resources/auxxsd/cenc.xsd
 * @module
 */

export const CENC_NAMESPACE_URI = 'urn:mpeg:cenc:2013'

/**
 * A 128-bit integer written in canonical UUID notation.
 * Must be in the form:
 * `[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}`
 */
export type KeyIdType = string

export interface CencContentProtection {
    readonly default_KID?: readonly KeyIdType[]
    readonly pssh?: Base64BinaryType
}
