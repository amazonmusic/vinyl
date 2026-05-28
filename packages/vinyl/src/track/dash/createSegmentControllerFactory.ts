/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReadonlyPlaybackController } from '../../playback/ReadonlyPlaybackController'
import {
    SegmentControllerImpl,
    type SegmentControllerImplOptions,
} from '../../streaming/SegmentControllerImpl'
import type { ContentType } from '../../streaming/MediaQualityMetadata'
import type { SegmentController } from '../../streaming/SegmentController'
import type { ObservableValue } from '@amazon/vinyl-observable'
import type { MediaTimeline } from '../../streaming/MediaTimeline'
import type { QualitySelector } from '../../streaming/abr/QualitySelector'

export type SegmentControllerFactory = (deps: {
    readonly mediaTimelineTransformed: ObservableValue<Promise<MediaTimeline>>
    readonly qualitySelector: QualitySelector
}) => SegmentController

export interface SegmentControllerFactoryDeps {
    readonly playbackController: ReadonlyPlaybackController
}

export function createSegmentControllerFactory(
    playerDeps: SegmentControllerFactoryDeps,
    contentType: ContentType,
    options?: Partial<SegmentControllerImplOptions>
) {
    return (trackDeps: {
        readonly mediaTimelineTransformed: ObservableValue<
            Promise<MediaTimeline>
        >
        readonly qualitySelector: QualitySelector
    }) => {
        return new SegmentControllerImpl(
            {
                ...playerDeps,
                ...trackDeps,
            },
            contentType,
            options
        )
    }
}
