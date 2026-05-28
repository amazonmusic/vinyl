/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MediaQualityMetadata } from '../../streaming/MediaQualityMetadata'
import { type DrmController } from '../../drm/DrmController'
import { MediaUnsupportedError } from '@amazon/vinyl-util'

export function throwKeySystemsUnsupported(): never {
    throw new MediaUnsupportedError('No key system supported.', 'key-system')
}

/**
 * Returns true when the media's key system is supported or the representation has no content protection.
 */
export async function canPlayKeySystem(
    deps: { readonly drmController: DrmController },
    metadata: MediaQualityMetadata
): Promise<boolean> {
    if (!metadata.contentProtections.length) return true // Is not content protected.
    return (await deps.drmController.isSupported(metadata)).supported
}
