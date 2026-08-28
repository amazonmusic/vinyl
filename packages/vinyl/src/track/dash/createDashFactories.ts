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
import { createDashContentStreamFactories } from './createDashContentStreamFactories'
import type { DrmKeySystemResolver } from '../../drm/DrmKeySystemResolver'
import type { DrmController } from '../../drm/DrmController'
import type { Capabilities } from '../../client/Capabilities'
import { QualitySelectorImpl } from '../../streaming/abr/QualitySelectorImpl'
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
import { createAllowedContentTypesValue } from '../../streaming/createAllowedContentTypesValue'
import type { ObservableValue } from '@amazon/vinyl-observable'
import type { VinylOptions } from '../../vinyl/VinylOptions'
import {
    buildDashMediaTimeline,
    type BuildDashMediaTimelineDeps,
} from './buildDashMediaTimeline'
import { createDefaultMediaTimelineTransformer } from '../../streaming/createDefaultMediaTimelineTransformer'
import type { DashManifestData } from './DashManifestProvider'
import { SidecarTextTrackController } from '../../text/SidecarTextTrackController'
import type { MediaTextTrackProvider } from '../../text/mediaTextTrackProvider'
import type { TextTrackRenderer } from '../../text/TextTrackRenderer'
import { discoverDashTextTracks } from '../../text/discoverDashTextTracks'
import type { AdController } from '../../ad/AdController'
import {
    ManifestControllerImpl,
    type ManifestControllerImplDeps,
} from '../../streaming/ManifestControllerImpl'

/**
 * Player-level dependencies needed for the Dash-specific factories.
 */
export interface DashFactoryDeps {
    readonly options: ObservableValue<
        Pick<VinylOptions, 'abr' | 'audio' | 'allowedContentTypes' | 'text'>
    >
    readonly playbackController: PlaybackController
    readonly playbackSource: PlaybackSource
    readonly drmKeySystemResolver: DrmKeySystemResolver
    readonly requestInterceptor: RequestInterceptor
    readonly drmController: DrmController
    readonly capabilities: Capabilities
    /**
     * The HTML media element. Required to attach sidecar text tracks via
     * `media.addTextTrack`.
     */
    readonly media: HTMLMediaElement

    /**
     * Creates and reuses the DOM text tracks for sidecar captions.
     */
    readonly textTrackProvider: MediaTextTrackProvider

    /**
     * Optional HTML cue renderer; null for native rendering.
     */
    readonly textTrackRenderer: TextTrackRenderer | null

    /**
     * The player-level ad controller. MseTrack sets discovered ad breaks on it
     * when the media timeline resolves.
     */
    readonly adController: AdController
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
                // Spreads all player-level deps so disposing this track's
                // container never disposes the shared player-level controllers.
                ...externalDependencies(deps),

                baseContentTypesValue: createDashContentTypesValue,
                contentTypesValue: createAllowedContentTypesValue,
                baseUrlSelector: () => pickFirstBaseUrlSelector,
                segmentRequestInit: () => loadOptions.segmentRequestInit,
                manifestProvider: createDashManifestProvider(loadOptions),
                manifestController: (
                    deps: ManifestControllerImplDeps<DashManifestData>
                ) => new ManifestControllerImpl(deps),
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
                audio: (deps: {
                    options: ObservableValue<Pick<VinylOptions, 'audio'>>
                }) => deps.options.pick('audio'),
                allowedContentTypes: (deps: {
                    options: ObservableValue<
                        Pick<VinylOptions, 'allowedContentTypes'>
                    >
                }) => deps.options.pick('allowedContentTypes'),
                abr: (deps: {
                    options: ObservableValue<Pick<VinylOptions, 'abr'>>
                }) => deps.options.pick('abr'),
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
                textTrackController: (deps: {
                    readonly textTrackProvider: MediaTextTrackProvider
                    readonly textTrackRenderer: TextTrackRenderer | null
                    readonly playbackController: PlaybackController
                    readonly manifestTransformed: ObservableValue<
                        Promise<DashManifestData>
                    >
                    readonly options: ObservableValue<
                        Pick<VinylOptions, 'text'>
                    >
                }) =>
                    new SidecarTextTrackController({
                        textTrackProvider: deps.textTrackProvider,
                        textTrackRenderer: deps.textTrackRenderer,
                        playbackController: deps.playbackController,
                        requestInit: loadOptions.requestInit ?? undefined,
                        options: deps.options.pick('text'),
                        textTracks: deps.manifestTransformed.map(
                            (manifestPromise) =>
                                manifestPromise.then((data) =>
                                    discoverDashTextTracks(
                                        data.manifest,
                                        data.baseUrl
                                    )
                                )
                        ),
                    }),
            } as const) satisfies Factories<DashTrackDeps>
    }
}
