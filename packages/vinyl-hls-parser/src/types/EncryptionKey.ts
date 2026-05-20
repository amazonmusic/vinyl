/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ValueSchema } from '@amazon/vinyl-validation'
import { isOneOf } from '@amazon/vinyl-validation'

/**
 * Encryption key metadata for an HLS media segment (EXT-X-KEY).
 *
 * Specifies how media segments are encrypted and provides the information needed to decrypt them.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8216#section-4.3.2.4
 */
export interface EncryptionKey {
    /** The encryption method applied to media segments (METHOD). */
    readonly method: EncryptionMethod

    /** The URI for obtaining the decryption key (URI). Required unless method is NONE. */
    readonly uri?: string

    /** The initialization vector for decryption as a hexadecimal string (IV). */
    readonly iv?: string

    /** The format of the key in the response (KEYFORMAT). Identifies the DRM system, e.g. FairPlay. */
    readonly keyFormat?: string

    /** A slash-separated list of integers indicating compatible key format versions (KEYFORMATVERSIONS). */
    readonly keyFormatVersions?: string
}

/**
 * The encryption method for an HLS segment (EXT-X-KEY METHOD attribute).
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8216#section-4.3.2.4
 */
export type EncryptionMethod =
    | 'NONE'
    | 'AES-128'
    | 'SAMPLE-AES'
    | 'SAMPLE-AES-CTR'

export const encryptionMethodValidator: ValueSchema<EncryptionMethod> = isOneOf(
    'NONE',
    'AES-128',
    'SAMPLE-AES',
    'SAMPLE-AES-CTR'
)
