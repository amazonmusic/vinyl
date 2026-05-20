/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HlsTrackLoadOptions, HlsTrackDeps } from './HlsTrack'
import type { Maybe, RequestInterceptor } from '@amazon/vinyl-util'
import { createMediaSource } from '../../util/media/mediaSource'
import { createDefaultHlsMediaQualityMetadataResolver } from './HlsMediaQualityMetadataResolver'
import {
    MediaSourceControllerImpl,
    type MediaSourceControllerImplDeps,
} from '../../streaming/buffering/MediaSourceController'
import { HlsManifestControllerImpl } from './HlsManifestController'
import {
    externalDependencies,
    type Factories,
    validateFactories,
} from '@amazon/vinyl-di'
import { createUrlHlsManifestProvider } from './createUrlHlsManifestProvider'
import type { ContentStreamingOptions } from '../../streaming/ContentStreamingOptions'
import { createHlsContentTypesValue } from './createHlsContentTypesValue'
import { createHlsContentStreamFactories } from './createHlsContentStreamFactories'
import { createContentStreamFactory } from '../../streaming/ContentStream'
import type { ObservableValue } from '@amazon/vinyl-observable'
import type { PlaybackController } from '../../playback/PlaybackController'
import type { DrmKeySystemResolver } from '../../drm/DrmKeySystemResolver'
import type { DrmController } from '../../drm/DrmController'
import type { Capabilities } from '../../client/Capabilities'
import type { PlaybackSource } from '../../playback/PlaybackSource'
import type { QualitySelectorImplOptions } from '../../streaming/abr/QualitySelectorImpl'
import { QualitySelectorImpl } from '../../streaming/abr/QualitySelectorImpl'
import type { VinylOptions } from '../../vinyl/VinylOptions'
import { createDefaultHlsManifestTransformer } from './createDefaultHlsManifestTransformer'
import {
    buildHlsMediaTimeline,
    type BuildHlsMediaTimelineDeps,
} from './buildHlsMediaTimeline'
import { createDefaultMediaTimelineTransformer } from '../../streaming/createDefaultMediaTimelineTransformer'
import type { HlsManifestData } from './HlsManifestProvider'

export interface HlsFactoryDeps {
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

export type HlsInitOptions = {
    readonly streaming?: Maybe<ContentStreamingOptions>
}

export function createHlsFactories(options: Maybe<HlsInitOptions>) {
    return (deps: HlsFactoryDeps) => {
        return (loadOptions: HlsTrackLoadOptions) => {
            const manifestProvider =
                loadOptions.manifestProvider ||
                createUrlHlsManifestProvider(
                    loadOptions.uri,
                    loadOptions.requestInit || undefined
                )

            return validateFactories({
                ...externalDependencies(deps),

                contentTypesValue: createHlsContentTypesValue,

                manifestController: () =>
                    new HlsManifestControllerImpl(manifestProvider),

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
            } as const) satisfies Factories<HlsTrackDeps>
        }
    }
}
