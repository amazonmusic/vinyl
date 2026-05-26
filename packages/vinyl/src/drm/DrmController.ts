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
import type { DrmInitDataType } from '@/streaming/DrmInitDataType'
import type { DrmKeySystem } from '@/drm/DrmKeySystem'
import type { MediaFormatMetadata } from '@/streaming/MediaQualityMetadata'
import type { BasicErrorEvent } from '@/event/BasicErrorEvent'
import type { DrmOptions } from '@/drm/DrmOptions'

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
}

export interface MediaKeysSetEvent {
    readonly keySystem: DrmKeySystem
}

export interface KeySessionEvent {
    readonly mimeType: string
    readonly initDataType: DrmInitDataType
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
     * @param abort If aborted, the created session will be closed.
     */
    initializeForPlayback(
        drmInfo: MediaFormatMetadata | null,
        abort?: ReadonlyAbort
    ): void

    /**
     * Sets content protection data on drm controller for the currently buffering media.
     *
     * The key session will be created on the 'encrypted' event when the decoder has been initialized.
     *
     * @param drmInfo Format metadata for the representation. May contain content protections.
     * @param abort If aborted, the created session from an 'encrypted' event will be closed.
     */
    setBufferingDrmInfo(
        drmInfo: MediaFormatMetadata | null,
        abort?: ReadonlyAbort
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
