/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Maybe, RequestInitOptions } from '@amazon/vinyl-util'
import { ErrorOrigin } from '@amazon/vinyl-util'
import {
    type TrackConfigOptions,
    type TrackFactory,
    type TrackLoadOptions,
    trackLoadOptionsValidator,
} from '../TrackFactory'
import type { Track } from '../Track'
import type { HlsManifestController } from './HlsManifestController'
import type { HlsManifestData } from './HlsManifestData'
import type { HlsMediaQualityMetadataResolver } from './HlsMediaQualityMetadataResolver'
import type { MseTrackDeps } from '../mse/MseTrack'
import { MseTrack } from '../mse/MseTrack'
import {
    func,
    isOneOf,
    object,
    type ObjectSchema,
} from '@amazon/vinyl-validation'
import type { Factories } from '@amazon/vinyl-di'
import type { ObservableValue } from '@amazon/vinyl-observable'
import type { MediaTimeline } from '../../streaming/MediaTimeline'
import type { ManifestProvider } from '../../streaming/ManifestController'

export interface HlsTrackLoadOptions extends TrackLoadOptions {
    readonly type: 'hls'
    readonly manifestProvider?: Maybe<ManifestProvider<HlsManifestData>>
    readonly requestInit?: Maybe<RequestInitOptions>
    readonly segmentRequestInit?: Maybe<RequestInitOptions>
    readonly config?: Maybe<TrackConfigOptions>
}

const loadOptionsValidator: ObjectSchema<HlsTrackLoadOptions> =
    trackLoadOptionsValidator.extend({
        manifestProvider: func().maybe().optional(),
        requestInit: object({}).cast<RequestInitOptions>().maybe().optional(),
        segmentRequestInit: object({})
            .cast<RequestInitOptions>()
            .maybe()
            .optional(),
        type: isOneOf('hls'),
    })

export interface HlsTrackDeps extends MseTrackDeps {
    readonly manifestController: HlsManifestController
    readonly manifestTransformed: ObservableValue<Promise<HlsManifestData>>
    readonly mediaQualityMetadataResolver: HlsMediaQualityMetadataResolver
    readonly mediaTimeline: ObservableValue<Promise<MediaTimeline>>
    readonly mediaTimelineTransformed: ObservableValue<Promise<MediaTimeline>>
}

export type HlsTrackFactoryDeps = {
    readonly createHlsFactories: (
        loadOptions: HlsTrackLoadOptions
    ) => Factories<HlsTrackDeps>
}

export function createHlsTrackFactory(
    deps: HlsTrackFactoryDeps
): TrackFactory<HlsTrackLoadOptions> {
    return {
        validate(options: HlsTrackLoadOptions) {
            loadOptionsValidator.assert(options, ErrorOrigin.API)
        },

        createTrack(loadOptions: HlsTrackLoadOptions): Track {
            return new MseTrack(
                loadOptions.uri,
                loadOptions.type,
                deps.createHlsFactories(loadOptions)
            )
        },
    }
}
