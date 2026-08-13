/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type DashManifestData,
    type DashManifestProvider,
} from './DashManifestProvider'
import {
    type TrackConfigOptions,
    type TrackFactory,
    type TrackLoadOptions,
    trackLoadOptionsValidator,
} from '../TrackFactory'
import type { ObservableValue } from '@amazon/vinyl-observable'
import {
    ErrorOrigin,
    type Maybe,
    type RequestInitOptions,
} from '@amazon/vinyl-util'
import {
    func,
    isOneOf,
    object,
    type ObjectSchema,
} from '@amazon/vinyl-validation'
import type { Track } from '../Track'
import { type Factories } from '@amazon/vinyl-di'
import type { DashMediaQualityMetadataResolver } from './DashMediaQualityMetadataResolver'
import { MseTrack, type MseTrackDeps } from '../mse/MseTrack'
import type { MediaTimeline } from '../../streaming/MediaTimeline'
import type { DashManifestController } from './DashManifestController'

export interface DashTrackLoadOptions extends TrackLoadOptions {
    readonly type: 'dash'

    /**
     * If set, will be used to resolve the dash manifest.
     * Otherwise, the uri will be assumed to represent a URL to an MPD.
     * The manifest provider is not expected to cache results.
     */
    readonly manifestProvider?: Maybe<DashManifestProvider>

    /**
     * If a manifest provider is not set, the uri will be used to fetch a manifest.
     * This can be set to provide Request initialization options such as headers or request method.
     */
    readonly requestInit?: Maybe<RequestInitOptions>

    /**
     * Request initialization options for segment requests, such as headers.
     * Range headers set by the player for byte-range requests will not be overridden.
     */
    readonly segmentRequestInit?: Maybe<RequestInitOptions>

    /**
     * Configuration options for the DashTrack.
     * Will be set before the track is activated.
     */
    readonly config?: Maybe<TrackConfigOptions>
}

const loadOptionsValidator: ObjectSchema<DashTrackLoadOptions> =
    trackLoadOptionsValidator.extend({
        manifestProvider: func().maybe().optional(),
        requestInit: object({}).cast<RequestInitOptions>().maybe().optional(),
        segmentRequestInit: object({})
            .cast<RequestInitOptions>()
            .maybe()
            .optional(),
        type: isOneOf('dash'),
    })

export type DashTrackFactoryDeps = {
    readonly createDashFactories: (
        loadOptions: DashTrackLoadOptions
    ) => Factories<DashTrackDeps>
}

export function createDashTrackFactory(
    deps: DashTrackFactoryDeps
): TrackFactory<DashTrackLoadOptions> {
    return {
        validate(options: DashTrackLoadOptions) {
            loadOptionsValidator.assert(options, ErrorOrigin.API)
        },

        createTrack(loadOptions: DashTrackLoadOptions): Track {
            return new MseTrack(
                loadOptions.uri,
                loadOptions.type,
                deps.createDashFactories(loadOptions)
            )
        },
    }
}

export interface DashTrackDeps extends MseTrackDeps {
    readonly manifestController: DashManifestController
    readonly mediaQualityMetadataResolver: DashMediaQualityMetadataResolver
    readonly manifestTransformed: ObservableValue<Promise<DashManifestData>>
    readonly mediaTimeline: ObservableValue<Promise<MediaTimeline>>
    readonly mediaTimelineTransformed: ObservableValue<Promise<MediaTimeline>>
}
