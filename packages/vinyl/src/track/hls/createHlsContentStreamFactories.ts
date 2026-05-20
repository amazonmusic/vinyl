/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MediaSourceController } from '@/streaming/buffering/MediaSourceController'
import type { PlaybackController } from '@/playback/PlaybackController'
import type { QualitySelector } from '@/streaming/abr/QualitySelector'
import type { ObservableValue } from '@amazon/vinyl-observable'
import { type ContentStreamImplDeps } from '@/streaming/ContentStream'
import type { ContentType } from '@/streaming/MediaQualityMetadata'
import {
    SourceBufferControllerImpl,
    type SourceBufferControllerImplDeps,
} from '@/streaming/buffering/SourceBufferController'
import {
    BufferingControllerImpl,
    type BufferingControllerImplDeps,
} from '@/streaming/buffering/BufferingController'
import {
    SegmentControllerImpl,
    type SegmentControllerImplDeps,
} from '@/streaming/SegmentControllerImpl'
import { type Maybe, memoize } from '@amazon/vinyl-util'
import {
    externalDependencies,
    type Factories,
    validateFactories,
} from '@amazon/vinyl-di'
import type { ContentStreamingOptions } from '@/streaming/ContentStreamingOptions'
import type { MediaTimeline } from '@/streaming/MediaTimeline'

export interface HlsContentStreamTrackDeps {
    readonly mediaSourceController: MediaSourceController
    readonly playbackController: PlaybackController
    readonly mediaTimelineTransformed: ObservableValue<Promise<MediaTimeline>>
    readonly qualitySelector: QualitySelector
}

export function createHlsContentStreamFactories(
    options: Maybe<ContentStreamingOptions>
) {
    return (deps: HlsContentStreamTrackDeps) =>
        memoize(
            (contentType: ContentType) => {
                return validateFactories({
                    ...externalDependencies(deps),
                    sourceBufferControllerFactory:
                        (deps: SourceBufferControllerImplDeps) => () =>
                            new SourceBufferControllerImpl(deps, contentType),
                    bufferingController: (deps: BufferingControllerImplDeps) =>
                        new BufferingControllerImpl(
                            deps,
                            contentType,
                            options?.buffering
                        ),
                    segmentController: (deps: SegmentControllerImplDeps) =>
                        new SegmentControllerImpl(
                            deps,
                            contentType,
                            options?.segmentController
                        ),
                } as const) satisfies Factories<ContentStreamImplDeps>
            },
            (contentType) => contentType
        )
}
