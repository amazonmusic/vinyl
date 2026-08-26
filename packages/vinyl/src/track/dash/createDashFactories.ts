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
        Pick<
            VinylOptions,
            | 'abr'
            | 'preferredAudioLanguage'
            | 'allowedContentTypes'
            | 'preferDescriptiveAudio'
            | 'preferredTextLanguage'
            | 'textCueStyle'
        >
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
                preferredAudioLanguage: (deps: {
                    options: ObservableValue<
                        Pick<VinylOptions, 'preferredAudioLanguage'>
                    >
                }) => deps.options.pick('preferredAudioLanguage'),
                allowedContentTypes: (deps: {
                    options: ObservableValue<
                        Pick<VinylOptions, 'allowedContentTypes'>
                    >
                }) => deps.options.pick('allowedContentTypes'),
                preferDescriptiveAudio: (deps: {
                    options: ObservableValue<
                        Pick<VinylOptions, 'preferDescriptiveAudio'>
                    >
                }) => deps.options.pick('preferDescriptiveAudio'),
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
                    readonly media: HTMLMediaElement
                    readonly manifestTransformed: ObservableValue<
                        Promise<DashManifestData>
                    >
                    readonly options: ObservableValue<
                        Pick<
                            VinylOptions,
                            'preferredTextLanguage' | 'textCueStyle'
                        >
                    >
                }) => {
                    const controller = new SidecarTextTrackController({
                        media: deps.media,
                        requestInit: loadOptions.requestInit ?? undefined,
                        preferredTextLanguage: deps.options.pick(
                            'preferredTextLanguage'
                        ),
                        cueStyle: deps.options.pick('textCueStyle'),
                    })
                    deps.manifestTransformed.onData((manifestPromise) => {
                        manifestPromise
                            .then((data) => {
                                controller.setTextTracks(
                                    discoverDashTextTracks(
                                        data.manifest,
                                        data.baseUrl
                                    )
                                )
                            })
                            .catch(() => {
                                // Manifest errors are surfaced through the
                                // manifest controller. Don't double-report.
                            })
                    })
                    return controller
                },
            } as const) satisfies Factories<DashTrackDeps>
    }
}
