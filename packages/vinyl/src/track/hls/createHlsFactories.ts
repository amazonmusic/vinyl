/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HlsTrackLoadOptions, HlsTrackDeps } from './HlsTrack'
import type { Maybe, RequestInterceptor } from '@amazon/vinyl-util'
import { resolveUrl } from '@amazon/vinyl-util'
import type { AdBreakInfo, AdController } from '../../ad/AdBreak'
import { discoverHlsInterstitials } from '../../ad/discoverHlsInterstitials'
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
import { SidecarTextTrackController } from '../../text/SidecarTextTrackController'
import { discoverHlsTextTracks } from '../../text/discoverHlsTextTracks'

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
        const adController = deps.adController
        return (loadOptions: HlsTrackLoadOptions) => {
            const manifestProvider =
                loadOptions.manifestProvider ||
                createUrlHlsManifestProvider(
                    loadOptions.uri,
                    loadOptions.requestInit || undefined
                )

            return validateFactories({
                ...externalDependencies(deps),
                adController: () => adController,

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
                        const timeline = buildHlsMediaTimeline(deps, data)
                        // Discover HLS Interstitials from the first variant's
                        // media playlist and attach to the timeline.
                        const adBreaks = await discoverAdsFromManifest(data)
                        if (adBreaks.length > 0) {
                            return { ...timeline, adBreaks }
                        }
                        return timeline
                    }),
                mediaTimelineTransformed: createDefaultMediaTimelineTransformer,
                textTrackController: (deps: {
                    readonly media: HTMLMediaElement
                    readonly manifestTransformed: ObservableValue<
                        Promise<HlsManifestData>
                    >
                }) => {
                    const controller = new SidecarTextTrackController({
                        media: deps.media,
                        requestInit: loadOptions.requestInit ?? undefined,
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

async function discoverAdsFromManifest(
    data: HlsManifestData
): Promise<readonly AdBreakInfo[]> {
    try {
        if (data.mainPlaylist.variants.length === 0) return []
        const variant = data.mainPlaylist.variants[0]
        const media = await data.getMediaPlaylist(variant.uri)
        const contentDuration = media.ended
            ? media.segments.reduce((sum, s) => sum + s.duration, 0)
            : null
        const playlistBaseUrl = resolveUrl(variant.uri, data.baseUrl)
        return discoverHlsInterstitials(media, playlistBaseUrl, contentDuration)
    } catch {
        return []
    }
}
