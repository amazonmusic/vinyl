/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CapabilitiesImplDeps } from '../client/CapabilitiesImpl'
import { CapabilitiesImpl } from '../client/CapabilitiesImpl'
import type { Merge, PartialDeep } from '@amazon/vinyl-util'
import { noop } from '@amazon/vinyl-util'
import type {
    PlaybackControllerImplDeps,
    PlaybackControllerImplOptions,
} from '../playback/PlaybackControllerImpl'
import { PlaybackControllerImpl } from '../playback/PlaybackControllerImpl'
import type { PlaybackSourceImplDeps } from '../playback/PlaybackSourceImpl'
import { PlaybackSourceImpl } from '../playback/PlaybackSourceImpl'
import {
    createVinylTrackFactories,
    type VinylTrackFactoryDeps,
} from '../track/createVinylTrackFactories'
import type {
    TrackControllerImplDeps,
    TrackControllerImplOptions,
} from '../track/TrackController'
import { TrackControllerImpl } from '../track/TrackController'
import { createTrackFactory } from '../track/TrackFactory'
import type { VinylDeps } from './VinylDeps'
import { type QualitySelectorImplOptions } from '../streaming/abr/QualitySelectorImpl'
import {
    AdControllerImpl,
    type AdControllerImplDeps,
    type AdControllerImplOptions,
} from '../ad/AdControllerImpl'
import { createDashFactories } from '../track/dash/createDashFactories'
import { createHlsFactories } from '../track/hls/createHlsFactories'
import {
    createMediaTextTrackProvider,
    type MediaTextTrackProvider,
} from '../text/mediaTextTrackProvider'
import type { TextTrackRenderer } from '../text/TextTrackRenderer'
import { type DrmOptions } from '../drm/DrmOptions'
import { commonEmeFactory } from '../drm/commonEme/CommonEmeFactory'
import {
    DrmControllerImpl,
    type DrmControllerImplDeps,
} from '../drm/DrmControllerImpl'
import { defaultDrmKeySystemResolver } from '../drm/DrmKeySystemResolver'
import { LoudnessNormalizationControllerImpl } from '../playback/loudness/LoudnessNormalizationControllerImpl'
import {
    AutoResetControllerImpl,
    type AutoResetControllerImplDeps,
    type AutoResetControllerImplOptions,
} from '../track/AutoResetController'
import type { Dependencies, Factories } from '@amazon/vinyl-di'
import { validateFactories } from '@amazon/vinyl-di'
import type { ContentStreamingOptions } from '../streaming/ContentStreamingOptions'
import {
    defaultVinylOptions,
    type VinylOptions,
    vinylOptionsValidator,
} from './VinylOptions'
import { playerConfigFactory } from './playerConfigFactory'
import type { ObservableValue } from '@amazon/vinyl-observable'
import { defaultAdLoadOptionsResolver } from '../ad/defaultAdLoadOptionsResolver'

/**
 * Configuration used by the default dependency factories for Vinyl.
 *
 * These options are used during player construction, changes after construction will have no
 * effect.
 */
export interface VinylDependencyOptions {
    /**
     * The media element.
     */
    readonly media: HTMLMediaElement

    /**
     * Optional renderer for text-track cues (an HTML overlay). When provided,
     * captions are painted by the renderer and the DOM text track is kept
     * `'hidden'`; without one they render natively. See `TextTrackRenderer`.
     */
    readonly textTrackRenderer?: TextTrackRenderer

    /**
     * Configuration for the track controller.
     */
    readonly trackController?: Partial<TrackControllerImplOptions>

    /**
     * Configuration for the playback controller.
     */
    readonly playbackController?: Partial<PlaybackControllerImplOptions>

    /**
     * Configuration for segmented streaming tracks (hls / dash).
     */
    readonly streaming?: PartialDeep<ContentStreamingOptions>

    /**
     * Configuration for all drm-related components.
     */
    readonly drm?: Partial<DrmOptions>

    /**
     * Configuration for adaptive bitrate switching.
     */
    readonly abr?: PartialDeep<QualitySelectorImplOptions>

    /**
     * Configuration for auto-reset behavior.
     */
    readonly autoReset?: Partial<AutoResetControllerImplOptions>

    /**
     * Configuration for the ad controller.
     */
    readonly adController?: Partial<AdControllerImplOptions>
}

/**
 * Creates the dependency factories for a standard player.
 *
 * @param options
 */
export function createVinylFactories(options: VinylDependencyOptions) {
    return validateFactories({
        options: playerConfigFactory<VinylOptions>(
            defaultVinylOptions,
            vinylOptionsValidator
        ),
        media: (): HTMLMediaElement => options.media,
        // One provider per media element (the player container creates each
        // dependency once), so text tracks are reused rather than accumulated.
        textTrackProvider: (deps: {
            readonly media: HTMLMediaElement
        }): MediaTextTrackProvider =>
            createMediaTextTrackProvider({ media: deps.media }),
        // App-provided cue renderer (or null for native rendering).
        textTrackRenderer: (): TextTrackRenderer | null =>
            options.textTrackRenderer ?? null,
        playbackController: (deps: PlaybackControllerImplDeps) =>
            new PlaybackControllerImpl(deps, options.playbackController),
        playbackSource: (deps: PlaybackSourceImplDeps) =>
            new PlaybackSourceImpl(deps),
        loudnessNormalizationController: (deps: {
            options: ObservableValue<
                Pick<VinylOptions, 'loudnessNormalization'>
            >
        }) =>
            new LoudnessNormalizationControllerImpl({
                options: deps.options.pick('loudnessNormalization'),
            }),
        capabilities: (deps: CapabilitiesImplDeps) =>
            new CapabilitiesImpl(deps),
        requestInterceptor: () => noop,
        trackFactory: (deps: VinylTrackFactoryDeps) =>
            createTrackFactory(createVinylTrackFactories(deps)),
        adTrackLoadOptionsProvider: () => defaultAdLoadOptionsResolver,
        trackController: (deps: TrackControllerImplDeps<any>) =>
            new TrackControllerImpl<any>(deps, options.trackController),
        drmKeySystemResolver: () => defaultDrmKeySystemResolver,
        drmController: (deps: DrmControllerImplDeps) =>
            new DrmControllerImpl(deps, options.drm),
        commonEme: commonEmeFactory,
        autoResetController: (deps: AutoResetControllerImplDeps) =>
            new AutoResetControllerImpl(deps, options.autoReset),
        adController: (deps: AdControllerImplDeps) =>
            new AdControllerImpl(deps, options.adController),
        createDashFactories: createDashFactories(options),
        createHlsFactories: createHlsFactories(options),
    } as const) satisfies Factories<VinylDeps>
}

/**
 * The dependency map type of the default player dependency factories.
 */
export type DefaultVinylFactories = ReturnType<typeof createVinylFactories>

/**
 * Provides the dependency type for a dependency with merged overrides.
 */
export type InferVinylOverrideDependencyType<
    Overrides,
    K extends keyof DefaultVinylFactories,
> = Dependencies<
    Overrides extends Factories
        ? Merge<DefaultVinylFactories, Overrides>
        : DefaultVinylFactories
>[K]
