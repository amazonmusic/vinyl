/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type Maybe,
    parseIntSafe,
    type ReadonlyRecord,
} from '@amazon/vinyl-util'

/**
 * https://www.w3.org/TR/encrypted-media-2/#dom-mediakeysystemmediacapability-encryptionscheme
 */
export type CencEncryptionScheme =
    /**
     * AES-CTR mode full sample and video NAL subsample encryption.
     */
    | 'cenc'

    /**
     * AES-CBC mode partial video NAL pattern encryption. For video, the spec allows various encryption patterns.
     */
    | 'cbcs'

    /**
     * The same as "cbcs" mode, but with a specific encrypt:skip pattern of 1:9 for video.
     */
    | 'cbcs-1-9'
    | string

export interface CencEncryptionSchemeAndVersion {
    readonly scheme: CencEncryptionScheme
    readonly version: number | null
}

const encryptionSchemeRegex = /([a-z]{4})(?::([\da-f]{1,8}))?/

const protectionSchemeCodes: ReadonlyRecord<
    string,
    CencEncryptionScheme | undefined
> = {
    ['cbcs']: 'cbcs',
    ['cenc']: 'cenc',
}

/**
 * 5.8.5.2.2 The MP4 Protection Scheme
 *
 * For Representations based on ISO/IEC 14496-12, the following URI is defined to indicate protection
 * schemes identified by the Scheme Type within the Scheme Type Box of the Protection Scheme
 * Information Box of the file:
 * urn:mpeg:dash:mp4protection:2011
 * In this scheme, the `value` attribute shall present and shall be the 4CC contained in the Scheme Type
 * Box, suitably percent-encoded according to IETF RFC 8141, and may include the version number. The
 * 4CC and the version number, if present, shall be separated by a ":". The version number shall be encoded
 * as up to 8 hexadecimal digits, where the leading '0's may be omitted.
 *
 * @param value
 */
export function parseCencEncryptionScheme(
    value: Maybe<string>
): CencEncryptionSchemeAndVersion | null {
    if (!value) return null
    const match = encryptionSchemeRegex.exec(value)
    if (!match) return null
    const version = parseIntSafe(match[2], 16)
    const scheme = protectionSchemeCodes[match[1]]
    if (!scheme) return null
    return {
        scheme,
        version,
    }
}
