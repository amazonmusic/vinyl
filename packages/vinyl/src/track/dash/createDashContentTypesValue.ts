/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DashManifestData } from './DashManifestProvider'
import type { DashMediaQualityMetadataResolver } from './DashMediaQualityMetadataResolver'
import { flattenRepresentations } from './util/mpd'
import type { ContentType } from '../../streaming/MediaQualityMetadata'
import type { ContentTypesValue } from '../../streaming/ContentTypesValue'
import type { ObservableValue } from '@amazon/vinyl-observable'
import type { DashManifest } from '@amazon/vinyl-mpd-parser'

export interface DashContentTypesValueDeps {
    readonly manifestTransformed: ObservableValue<Promise<DashManifestData>>
    readonly mediaQualityMetadataResolver: DashMediaQualityMetadataResolver
}

/**
 * Creates an ObservableValue for the types of streams that are available in the
 * filtered dash manifest.
 */
export function createDashContentTypesValue(
    deps: DashContentTypesValueDeps
): ContentTypesValue {
    return deps.manifestTransformed.map(async (manifestAndPath) => {
        return getContentTypes(deps, (await manifestAndPath).manifest)
    })
}

/**
 * Determines the types of streams that are available in the filtered dash
 * manifest.
 *
 * Given a Dash manifest, this will resolve to the set of content types present.
 */
function getContentTypes(
    deps: DashContentTypesValueDeps,
    manifest: DashManifest
): Set<ContentType> {
    const contentTypes = new Set<ContentType>()
    for (const period of manifest.MPD.Period) {
        if (!period.AdaptationSet) continue
        const mediaMetadata = flattenRepresentations(period).map(
            deps.mediaQualityMetadataResolver
        )
        for (const { contentType } of mediaMetadata) {
            if (contentType) contentTypes.add(contentType)
        }
    }
    return contentTypes
}
