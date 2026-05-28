/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MediaQualityMetadata } from '../MediaQualityMetadata'

export interface PrefetchState {
    /**
     * The number of seconds currently prefetched.
     */
    readonly fetchedTime: number

    /**
     * The quality metadata of the previous segment. Quality selection may have a bias to prefer avoiding
     * decoder re-initialization.
     */
    readonly previousQuality: MediaQualityMetadata | null

    /**
     * True when prefetching for the active track.
     */
    readonly active: boolean
}

export interface QualitySelector {
    /**
     * Returns the quality that should currently be streamed.
     *
     * @param qualities A sorted list of qualities for the currently streaming media.
     * All qualities are expected to be playable.
     *
     * Higher bandwidth values are expected to also mean higher quality.
     * That is, if there are multiple playable qualities where one has a higher quality ranking and lower bandwidth,
     * the less efficient representation should be filtered out before the request.
     * @param prefetchState The current prefetch state.
     *
     * @return Returns the index of the quality to stream.
     */
    selectQuality(
        qualities: readonly MediaQualityMetadata[],
        prefetchState: PrefetchState
    ): number
}
