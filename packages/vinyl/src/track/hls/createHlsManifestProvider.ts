/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HlsTrackLoadOptions } from './HlsTrack'
import { createUrlHlsManifestProvider } from './createUrlHlsManifestProvider'
import type { ManifestProvider } from '../../streaming/ManifestController'
import type { HlsManifestData } from './HlsManifestData'

export function createHlsManifestProvider(
    loadOptions: HlsTrackLoadOptions
): HlsManifestProvider {
    return (
        loadOptions.manifestProvider ||
        createUrlHlsManifestProvider(
            loadOptions.uri,
            loadOptions.requestInit || undefined
        )
    )
}

export type HlsManifestProvider = ManifestProvider<HlsManifestData>
