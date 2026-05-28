/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    AdaptationSetType,
    DashManifest,
    RepresentationType,
} from '@amazon/vinyl-mpd-parser'
import type { DashManifestData } from './DashManifestProvider'
import type { ObservableValue } from '@amazon/vinyl-observable'
import {
    clone,
    type Comparator,
    type FilterPredicate,
    type MaybePromise,
} from '@amazon/vinyl-util'

/**
 * Returns true if the given Dash manifest has unfiltered representations in every Period.
 */
export function manifestIsPlayable(manifest: DashManifest): boolean {
    return manifest.MPD.Period.every((period) =>
        period.AdaptationSet?.some(
            (adaptationSet) => adaptationSet.Representation?.length
        )
    )
}

/**
 * Filters dash representations using a synchronous predicate.
 */
export function filterDashRepresentations(
    filter: FilterPredicate<RepresentationType>,
    throwError: () => never,
    manifest: DashManifest
): DashManifest {
    const result = clone(manifest)

    for (const period of result.MPD.Period) {
        if (period.AdaptationSet) {
            for (const adaptationSet of period.AdaptationSet) {
                if (adaptationSet.Representation) {
                    adaptationSet.Representation =
                        adaptationSet.Representation.filter(filter)
                }
            }
        }
    }

    if (!manifestIsPlayable(result)) {
        throwError()
    }

    return result
}

/**
 * Filters dash adaptation sets using a synchronous predicate.
 */
export function filterDashAdaptationSets(
    filter: FilterPredicate<AdaptationSetType>,
    throwError: () => never,
    manifest: DashManifest
): DashManifest {
    const result = clone(manifest)

    for (const period of result.MPD.Period) {
        if (period.AdaptationSet) {
            period.AdaptationSet = period.AdaptationSet.filter(filter)
        }
    }

    if (!manifestIsPlayable(result)) {
        throwError()
    }

    return result
}

/**
 * Sorts dash adaptation sets using a comparator.
 */
export function sortDashAdaptationSets(
    comparator: Comparator<AdaptationSetType>,
    manifest: DashManifest
): DashManifest {
    const result = clone(manifest)

    for (const period of result.MPD.Period) {
        period.AdaptationSet?.sort(comparator)
    }

    return result
}

/**
 * Sorts dash representations using a comparator.
 */
export function sortDashRepresentations(
    comparator: Comparator<RepresentationType>,
    manifest: DashManifest
): DashManifest {
    const result = clone(manifest)

    for (const period of result.MPD.Period) {
        if (period.AdaptationSet) {
            for (const adaptationSet of period.AdaptationSet) {
                if (adaptationSet.Representation) {
                    adaptationSet.Representation.sort(comparator)
                }
            }
        }
    }

    return result
}

/**
 * Maps a manifest transformation function over a DashManifestData observable.
 * Handles the boilerplate of extracting manifest/baseUrl and reconstructing the result.
 */
export function mapManifestTransform(
    manifestController: ObservableValue<Promise<DashManifestData>>,
    transformManifest: (manifest: DashManifest) => MaybePromise<DashManifest>
): ObservableValue<Promise<DashManifestData>> {
    return manifestController.map(async (manifestAndPath) => {
        const { manifest, baseUrl } = await manifestAndPath
        return {
            baseUrl,
            manifest: await transformManifest(manifest),
        }
    })
}
