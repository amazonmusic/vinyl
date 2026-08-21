/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type AnyRecord,
    type Maybe,
    type ReadonlyAbort,
    type ReadonlyEventHost,
} from '@amazon/vinyl-util'
import type { DrmInitDataType } from '../streaming/DrmInitDataType'
import type { DrmKeySystem } from './DrmKeySystem'
import type { MediaFormatMetadata } from '../streaming/MediaQualityMetadata'
import type { BasicErrorEvent } from '../event/BasicErrorEvent'
import type { DrmOptions } from './DrmOptions'
import type { LoadSpanMeasurement } from '../streaming/LoadMetric'
import type { TrackUri } from '../track/Track'

export interface DrmControllerEventMap {
    /**
     * A DRM error occurred.
     */
    readonly error: BasicErrorEvent

    /**
     * Emitted when the error state has been reset.
     */
    readonly reset: AnyRecord

    /**
     * The media keys have been created and set.
     *
     * This will happen after the first call to `initialize` or after the first 'encrypted' event is handled.
     */
    readonly mediaKeysSet: MediaKeysSetEvent

    /**
     * Dispatched after a key session has been created.
     */
    readonly sessionCreate: KeySessionEvent

    /**
     * Dispatched after a key session has been closed.
     */
    readonly sessionClose: KeySessionEvent

    /**
     * A license exchange completed. The span is attributed at the source to the
     * track that initiated the license request (via the key session that
     * produced the message), so concurrent exchanges for the active and a
     * preloaded track do not cross-attribute. The player republishes it as
     * `loadSpan` using the carried `trackUri`.
     */
    readonly loadSpanMeasured: LoadSpanMeasurement
}

export interface MediaKeysSetEvent {
    readonly keySystem: DrmKeySystem
}

export interface KeySessionEvent {
    readonly mimeType: string
    readonly initDataType: DrmInitDataType
}

/**
 * Options for {@link DrmController.initializeForPlayback} and
 * {@link DrmController.setBufferingDrmInfo}.
 */
export interface DrmPlaybackOptions {
    /**
     * The track initiating playback/buffering. Stamped onto any created key
     * session so its license `loadSpanMeasured` attributes to the correct track.
     */
    readonly trackUri?: TrackUri | null

    /**
     * If aborted, the created session will be closed.
     */
    readonly abort?: ReadonlyAbort
}

/**
 * DrmController manages media keys and sessions, provides tracks a way to declare their content protections.
 */
export interface DrmController extends ReadonlyEventHost<DrmControllerEventMap> {
    /**
     * The last error emitted.
     * Use `reset` to reset error state.
     */
    readonly error: Error | null

    /**
     * Configures this DrmController for the current track.
     * This will override any player-level configuration.
     * @param options
     */
    configure(options: Maybe<Partial<DrmOptions>>): void

    /**
     * Returns true if Encrypted Media Extensions are supported.
     */
    isEmeSupported(): boolean

    /**
     * Resolves to true if the given encryption metadata is supported.
     * @param drmInfo
     */
    isSupported(drmInfo: MediaFormatMetadata): Promise<DrmKeySystemSupport>

    /**
     * Initializes media keys if they have not yet been created and attached, creates a key session if the
     * selected `DrmProtection` contains PSSH data.
     *
     * The first supported key system will be used.
     * Once a key system has been set, it cannot be changed, all future content protections will be
     * expected to contain the supported key system.
     *
     * @param drmInfo Format metadata for the representation. May contain content protections.
     * @param options Playback options ({@link DrmPlaybackOptions}).
     */
    initializeForPlayback(
        drmInfo: MediaFormatMetadata | null,
        options?: DrmPlaybackOptions
    ): void

    /**
     * Sets content protection data on drm controller for the currently buffering media.
     *
     * The key session will be created on the 'encrypted' event when the decoder has been initialized.
     *
     * @param drmInfo Format metadata for the representation. May contain content protections.
     * @param options Buffering options ({@link DrmPlaybackOptions}).
     */
    setBufferingDrmInfo(
        drmInfo: MediaFormatMetadata | null,
        options?: DrmPlaybackOptions
    ): void

    /**
     * Clears all active DRM sessions.
     * This should not be called unless the audio source has been cleared.
     */
    closeSessions(): void

    /**
     * Resets the error state.
     */
    reset(): void
}

export type DrmKeySystemSupport = {
    /**
     * True if the key system is supported.
     */
    readonly supported: boolean

    /**
     * True if the key system and persistent state is supported.
     */
    readonly persistentState: boolean
}
