/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ObservableValue } from '@amazon/vinyl-observable'
import type { DashManifestData } from './DashManifestProvider'
import type {
    AdaptationSetType,
    DashManifest,
    RepresentationType,
} from '@amazon/vinyl-mpd-parser'
import { type Comparator, compareBy } from '@amazon/vinyl-util'
import {
    sortDashAdaptationSets,
    sortDashRepresentations,
} from './manifestTransformUtils'

export interface DashManifestTransformerDeps {
    readonly manifestController: ObservableValue<Promise<DashManifestData>>
}

/**
 * The default dash manifest transformer sorts adaptation sets and representations.
 * Quality filtering is handled by the media timeline transformer.
 */
export function createDefaultDashManifestTransformer(
    deps: DashManifestTransformerDeps
): ObservableValue<Promise<DashManifestData>> {
    return deps.manifestController.map(async (manifestAndPath) => {
        const { manifest, baseUrl } = await manifestAndPath
        let m: DashManifest = sortDashAdaptationSets(
            createDefaultAdaptationSetComparator(),
            manifest
        )
        m = sortDashRepresentations(createDefaultRepresentationComparator(), m)
        return { baseUrl, manifest: m }
    })
}

/**
 * The default adaptation set comparator orders by descending selectionPriority.
 */
export function createDefaultAdaptationSetComparator(): Comparator<AdaptationSetType> {
    return compareBy((adaptationSet) => -adaptationSet.selectionPriority)
}

/**
 * The default representation comparator orders by ascending quality ranking and descending bandwidth.
 */
export function createDefaultRepresentationComparator(): Comparator<RepresentationType> {
    return compareBy(
        (representation) => representation.qualityRanking,
        (representation) => -representation.bandwidth
    )
}
