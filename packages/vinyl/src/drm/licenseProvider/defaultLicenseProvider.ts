/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReadonlyAbort } from '@amazon/vinyl-util'
import { requestWithRetry, ValidationError } from '@amazon/vinyl-util'
import type { DrmKeySystem } from '../DrmKeySystem'
import type { LicenseProvider, LicenseServerOptions } from './LicenseProvider'

/**
 * A basic LicenseProvider which uses the configuration set for the current key system,
 * transmits a challenge as the body, and returns an array buffer.
 *
 * @param keySystem The key system for the current license challenge.
 * @param serverOptions The resolved configuration. The default DrmController
 * implementation provides this from the `drm` configuration set when creating
 * a new player.
 * @param challenge The license challenge, provided by the CDM (Content Decryption
 * Module)
 * @param abort (optional) When aborted, should cancel any active requests.
 */
export const defaultLicenseProvider: LicenseProvider = async (
    keySystem: DrmKeySystem,
    serverOptions: LicenseServerOptions,
    challenge: ArrayBuffer,
    abort?: ReadonlyAbort
): Promise<ArrayBuffer> => {
    if (serverOptions.url == null) {
        throw new ValidationError(
            `Missing licenseServer url in DRM configuration for keySystem: ${keySystem}`
        )
    }
    const res = await requestWithRetry(
        serverOptions.url,
        {
            method: 'POST',
            ...serverOptions.init,
            body: challenge,
        },
        { abort }
    )
    return await res.arrayBuffer()
}
