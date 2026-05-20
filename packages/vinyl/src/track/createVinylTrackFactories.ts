/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createSourceObjectTrackFactory,
    type SourceObjectTrackDeps,
    type SourceObjectTrackLoadOptions,
} from '@/track/source/SourceObjectTrack'
import {
    createSourceTrackFactory,
    type SourceTrackDeps,
    type SourceTrackLoadOptions,
} from '@/track/source/SourceTrack'
import type { TrackTypeId } from '@/track/Track'
import type { TrackFactory } from '@/track/TrackFactory'
import type { ReadonlyRecord } from '@amazon/vinyl-util'
import {
    createDashTrackFactory,
    type DashTrackFactoryDeps,
    type DashTrackLoadOptions,
} from '@/track/dash/DashTrack'
import {
    createHlsTrackFactory,
    type HlsTrackFactoryDeps,
    type HlsTrackLoadOptions,
} from '@/track/hls/HlsTrack'

export interface VinylTrackFactoryDeps
    extends SourceTrackDeps,
        SourceObjectTrackDeps,
        DashTrackFactoryDeps,
        HlsTrackFactoryDeps {}

export type VinylTrackLoadOptions =
    | SourceObjectTrackLoadOptions
    | SourceTrackLoadOptions
    | DashTrackLoadOptions
    | HlsTrackLoadOptions

/**
 * Provides a map of track type id to their respective loaders.
 * @param deps
 */
export function createVinylTrackFactories(deps: VinylTrackFactoryDeps) {
    return {
        src: createSourceTrackFactory(deps),
        srcObject: createSourceObjectTrackFactory(deps),
        dash: createDashTrackFactory(deps),
        hls: createHlsTrackFactory(deps),
    } as const satisfies ReadonlyRecord<
        TrackTypeId,
        TrackFactory<VinylTrackLoadOptions>
    >
}
