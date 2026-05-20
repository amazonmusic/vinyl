/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This represents the initialization data from the encrypted event.
 *
 * - msneedkey: Uint8Array
 * - webkitneedkey: ArrayBuffer
 * - encrypted: ArrayBuffer
 */
export type EncryptedInitData = ArrayBuffer | Uint8Array
