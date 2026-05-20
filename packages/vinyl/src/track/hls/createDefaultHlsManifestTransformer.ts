/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ObservableValue } from '@amazon/vinyl-observable'
import type { HlsManifestData } from '@/track/hls/HlsManifestProvider'

export interface HlsManifestTransformerDeps {
    readonly manifestController: ObservableValue<Promise<HlsManifestData>>
}

/**
 * The default HLS manifest transformer sorts variants by bandwidth descending (highest quality first).
 * Quality and language filtering is handled by the media timeline transformer.
 */
export function createDefaultHlsManifestTransformer(
    deps: HlsManifestTransformerDeps
): ObservableValue<Promise<HlsManifestData>> {
    return deps.manifestController.map(async (v) => {
        const data = await v
        const sorted = [...data.mainPlaylist.variants].sort(
            (a, b) => b.bandwidth - a.bandwidth
        )
        return {
            ...data,
            mainPlaylist: {
                ...data.mainPlaylist,
                variants: sorted,
            },
        }
    })
}
