/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReadonlyAbort } from '@amazon/vinyl-util'
import type { DashManifest } from '@amazon/vinyl-mpd-parser'

/**
 * Provides a dash manifest.
 */
export type DashManifestProvider = (
    abort?: ReadonlyAbort
) => Promise<DashManifestData>

export interface DashManifestData {
    /**
     * The Dash manifest.
     */
    readonly manifest: DashManifest

    /**
     * The URL to be used for relative requests. Guaranteed to be absolute.
     *
     * Media with relative paths in the manifests will be resolved relative to this URL.
     */
    readonly baseUrl: string
}
