/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Capabilities } from '@/client/Capabilities'
import type { PlaybackController } from '@/playback/PlaybackController'
import type { PlaybackSource } from '@/playback/PlaybackSource'
import type { VinylTrackLoadOptions } from '@/track/createVinylTrackFactories'
import type { TrackController } from '@/track/TrackController'
import type { TrackLoadOptions } from '@/track/TrackFactory'
import type { DrmController } from '@/drm/DrmController'
import type { AutoResetController } from '@/track/AutoResetController'
import type { MutableValue } from '@amazon/vinyl-observable'
import type { VinylOptions } from '@/vinyl/VinylOptions'

export interface VinylDeps<
    TrackLoadOptionsType extends TrackLoadOptions = VinylTrackLoadOptions,
    OptionsType = VinylOptions,
> {
    /**
     * A mutable provider for configuration options.
     */
    readonly options: MutableValue<OptionsType>

    /**
     * Controls playback.
     */
    readonly playbackController: PlaybackController

    /**
     * An API to set the media source.
     */
    readonly playbackSource: PlaybackSource

    /**
     * Client capabilities.
     */
    readonly capabilities: Capabilities

    /**
     * The TrackController, responsible for track queue and activation.
     */
    readonly trackController: TrackController<TrackLoadOptionsType>

    /**
     * Digital Rights Management controller.
     */
    readonly drmController: DrmController

    /**
     * Notifies when playback can automatically reset after a failure.
     */
    readonly autoResetController: AutoResetController
}
