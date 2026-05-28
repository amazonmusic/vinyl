/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DashTrackDeps, DashTrackLoadOptions } from './DashTrack'
import { type Maybe, type RequestInterceptor } from '@amazon/vinyl-util'
import { pickFirstBaseUrlSelector } from './util/uriResolution'
import { createDefaultDashManifestTransformer } from './createDefaultDashManifestTransformer'
import { createMediaSource } from '../../util/media/mediaSource'
import {
    createDefaultDashMediaQualityMetadataResolver,
    type DashMediaQualityMetadataResolverDeps,
} from './DashMediaQualityMetadataResolver'
import {
    MediaSourceControllerImpl,
    type MediaSourceControllerImplDeps,
} from '../../streaming/buffering/MediaSourceController'
import type { PlaybackController } from '../../playback/PlaybackController'
import {
    type DashManifestController,
    DashManifestControllerImpl,
    type DashManifestControllerImplDeps,
} from './DashManifestController'
import { createDashContentStreamFactories } from './createDashContentStreamFactories'
import type { DrmKeySystemResolver } from '../../drm/DrmKeySystemResolver'
import type { DrmController } from '../../drm/DrmController'
import type { Capabilities } from '../../client/Capabilities'
import {
    QualitySelectorImpl,
    type QualitySelectorImplOptions,
} from '../../streaming/abr/QualitySelectorImpl'
import type { PlaybackSource } from '../../playback/PlaybackSource'
import {
    externalDependencies,
    type Factories,
    validateFactories,
} from '@amazon/vinyl-di'
import { createDashManifestProvider } from './createDashManifestProvider'
import { createContentStreamFactory } from '../../streaming/ContentStream'
import type { ContentStreamingOptions } from '../../streaming/ContentStreamingOptions'
import { createDashContentTypesValue } from './createDashContentTypesValue'
import type { ObservableValue } from '@amazon/vinyl-observable'
import type { VinylOptions } from '../../vinyl/VinylOptions'
import {
    buildDashMediaTimeline,
    type BuildDashMediaTimelineDeps,
} from './buildDashMediaTimeline'
import { createDefaultMediaTimelineTransformer } from '../../streaming/createDefaultMediaTimelineTransformer'
import type { DashManifestData } from './DashManifestProvider'

/**
 * Player-level dependencies needed for the Dash-specific factories.
 */
export interface DashFactoryDeps {
    readonly options: ObservableValue<{
        readonly abr: QualitySelectorImplOptions
        readonly preferredAudioLanguage: string | null
    }>
    readonly playbackController: PlaybackController
    readonly playbackSource: PlaybackSource
    readonly drmKeySystemResolver: DrmKeySystemResolver
    readonly requestInterceptor: RequestInterceptor
    readonly drmController: DrmController
    readonly capabilities: Capabilities
}

export type DashInitOptions = {
    readonly streaming?: Maybe<ContentStreamingOptions>
}

/**
 * Returns a function that provides default dependency factories required for
 * a new DashTrack.
 */
export function createDashFactories(options: Maybe<DashInitOptions>) {
    return (
        // Player-level dependencies
        deps: DashFactoryDeps
    ) => {
        return (loadOptions: DashTrackLoadOptions) =>
            validateFactories({
                // Track-level dependencies
                ...externalDependencies(deps),

                contentTypesValue: createDashContentTypesValue,
                baseUrlSelector: () => pickFirstBaseUrlSelector,
                segmentRequestInit: () => loadOptions.segmentRequestInit,
                manifestProvider: createDashManifestProvider(loadOptions),
                manifestController: (
                    deps: DashManifestControllerImplDeps
                ): DashManifestController =>
                    new DashManifestControllerImpl(deps),
                mediaSourceFactory: () => createMediaSource,
                mediaQualityMetadataResolver: (
                    deps: DashMediaQualityMetadataResolverDeps
                ) => createDefaultDashMediaQualityMetadataResolver(deps),
                mediaSourceController: (deps: MediaSourceControllerImplDeps) =>
                    new MediaSourceControllerImpl(deps),

                createContentStreamFactories: createDashContentStreamFactories(
                    options?.streaming
                ),
                contentStreamFactory: createContentStreamFactory,

                qualitySelector: (deps: {
                    options: ObservableValue<Pick<VinylOptions, 'abr'>>
                }) =>
                    new QualitySelectorImpl({
                        options: deps.options.pick('abr'),
                    }),
                manifestTransformed: createDefaultDashManifestTransformer,
                mediaTimeline: (
                    deps: BuildDashMediaTimelineDeps & {
                        readonly manifestTransformed: ObservableValue<
                            Promise<DashManifestData>
                        >
                    }
                ) =>
                    deps.manifestTransformed.map(async (manifestPromise) => {
                        const data = await manifestPromise
                        return buildDashMediaTimeline(deps, data)
                    }),
                mediaTimelineTransformed: createDefaultMediaTimelineTransformer,
            } as const) satisfies Factories<DashTrackDeps>
    }
}
