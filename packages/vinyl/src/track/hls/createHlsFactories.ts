/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HlsTrackDeps, HlsTrackLoadOptions } from './HlsTrack'
import type { Maybe, RequestInterceptor } from '@amazon/vinyl-util'
import type { AdController } from '../../ad/AdController'
import { createMediaSource } from '../../util/media/mediaSource'
import { createDefaultHlsMediaQualityMetadataResolver } from './HlsMediaQualityMetadataResolver'
import {
    MediaSourceControllerImpl,
    type MediaSourceControllerImplDeps,
} from '../../streaming/buffering/MediaSourceController'
import {
    externalDependencies,
    type Factories,
    validateFactories,
} from '@amazon/vinyl-di'
import type { ContentStreamingOptions } from '../../streaming/ContentStreamingOptions'
import { createHlsContentTypesValue } from './createHlsContentTypesValue'
import { createAllowedContentTypesValue } from '../../streaming/createAllowedContentTypesValue'
import { createHlsContentStreamFactories } from './createHlsContentStreamFactories'
import { createContentStreamFactory } from '../../streaming/ContentStream'
import type { ObservableValue } from '@amazon/vinyl-observable'
import type { PlaybackController } from '../../playback/PlaybackController'
import type { DrmKeySystemResolver } from '../../drm/DrmKeySystemResolver'
import type { DrmController } from '../../drm/DrmController'
import type { Capabilities } from '../../client/Capabilities'
import type { PlaybackSource } from '../../playback/PlaybackSource'
import { QualitySelectorImpl } from '../../streaming/abr/QualitySelectorImpl'
import type { VinylOptions } from '../../vinyl/VinylOptions'
import { createDefaultHlsManifestTransformer } from './createDefaultHlsManifestTransformer'
import {
    buildHlsMediaTimeline,
    type BuildHlsMediaTimelineDeps,
} from './buildHlsMediaTimeline'
import { createDefaultMediaTimelineTransformer } from '../../streaming/createDefaultMediaTimelineTransformer'
import type { HlsManifestData } from './HlsManifestData'
import { SidecarTextTrackController } from '../../text/SidecarTextTrackController'
import { discoverHlsTextTracks } from '../../text/discoverHlsTextTracks'
import {
    ManifestControllerImpl,
    type ManifestControllerImplDeps,
} from '../../streaming/ManifestControllerImpl'
import { createHlsManifestProvider } from './createHlsManifestProvider'

export interface HlsFactoryDeps {
    readonly options: ObservableValue<
        Pick<
            VinylOptions,
            | 'abr'
            | 'preferredAudioLanguage'
            | 'allowedContentTypes'
            | 'preferDescriptiveAudio'
            | 'preferredTextLanguage'
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

export type HlsInitOptions = {
    readonly streaming?: Maybe<ContentStreamingOptions>
}

export function createHlsFactories(options: Maybe<HlsInitOptions>) {
    return (deps: HlsFactoryDeps) => {
        return (loadOptions: HlsTrackLoadOptions) => {
            return validateFactories({
                // Spreads all player-level deps (including adController) as
                // external, non-owned dependencies so disposing this track's
                // container never disposes the shared player-level controllers.
                ...externalDependencies(deps),

                baseContentTypesValue: createHlsContentTypesValue,
                contentTypesValue: createAllowedContentTypesValue,

                manifestProvider: () => createHlsManifestProvider(loadOptions),
                manifestController: (
                    deps: ManifestControllerImplDeps<HlsManifestData>
                ) => new ManifestControllerImpl(deps),

                manifestTransformed: createDefaultHlsManifestTransformer,

                mediaQualityMetadataResolver: () =>
                    createDefaultHlsMediaQualityMetadataResolver(),

                mediaSourceFactory: () => createMediaSource,

                mediaSourceController: (deps: MediaSourceControllerImplDeps) =>
                    new MediaSourceControllerImpl(deps),

                segmentRequestInit: () => loadOptions.segmentRequestInit,

                createContentStreamFactories: createHlsContentStreamFactories(
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

                mediaTimeline: (
                    deps: BuildHlsMediaTimelineDeps & {
                        readonly manifestTransformed: ObservableValue<
                            Promise<HlsManifestData>
                        >
                    }
                ) =>
                    deps.manifestTransformed.map(async (manifestPromise) => {
                        const data = await manifestPromise
                        return buildHlsMediaTimeline(deps, data)
                    }),
                mediaTimelineTransformed: createDefaultMediaTimelineTransformer,
                textTrackController: (deps: {
                    readonly media: HTMLMediaElement
                    readonly manifestTransformed: ObservableValue<
                        Promise<HlsManifestData>
                    >
                    readonly options: ObservableValue<
                        Pick<VinylOptions, 'preferredTextLanguage'>
                    >
                }) => {
                    const controller = new SidecarTextTrackController({
                        media: deps.media,
                        requestInit: loadOptions.requestInit ?? undefined,
                        preferredTextLanguage: deps.options.pick(
                            'preferredTextLanguage'
                        ),
                    })
                    deps.manifestTransformed.onData((manifestPromise) => {
                        manifestPromise
                            .then((data) => {
                                controller.setTextTracks(
                                    discoverHlsTextTracks(
                                        data.mainPlaylist,
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
            } as const) satisfies Factories<HlsTrackDeps>
        }
    }
}
