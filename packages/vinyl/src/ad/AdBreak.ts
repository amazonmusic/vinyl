/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChangeEvent } from '../event/ChangeEvent'
import type { ReadonlyEventHost } from '@amazon/vinyl-util'

/**
 * Where an ad break is scheduled relative to the main content.
 *
 *  - `preroll`  - before content playback begins (start time at or near 0).
 *  - `midroll`  - during content playback.
 *  - `postroll` - at the end of content playback.
 */
export type AdBreakPlacement = 'preroll' | 'midroll' | 'postroll'

/**
 * A provider-agnostic description of a single ad break on the media timeline.
 *
 * An ad break is a span of the presentation that carries advertising rather
 * than primary content. The same shape is produced from HLS Interstitials
 * (EXT-X-DATERANGE with `CLASS="com.apple.hls.interstitial"`) and, in the
 * future, from DASH SCTE-35 splice signals, so applications observe one
 * interface regardless of the streaming protocol.
 *
 * Times are expressed on the player's media timeline, in seconds, so they can
 * be compared directly against {@link ReadonlyPlaybackController.currentTime}.
 */
export interface AdBreakInfo {
    /**
     * A stable identifier for this ad break, unique within the current media
     * presentation. Derived from the source signal (e.g. the HLS DATERANGE ID).
     */
    readonly id: string

    /**
     * The start time of the ad break on the media timeline, in seconds.
     */
    readonly startTime: number

    /**
     * The duration of the ad break in seconds, or null when unknown (e.g. a
     * still-open live break that has not yet resolved its end).
     */
    readonly duration: number | null

    /**
     * The scheduled placement of the break relative to primary content.
     */
    readonly placement: AdBreakPlacement

    /**
     * The individual ad assets that make up this break, in playback order.
     * May be empty when the source signals a break whose assets are resolved
     * asynchronously (e.g. an HLS `X-ASSET-LIST` not yet fetched).
     */
    readonly ads: readonly AdInfo[]

    /**
     * Provider-specific metadata carried verbatim from the source signal, for
     * applications that need details beyond the abstract model (e.g. the raw
     * HLS `X-` client attributes, or a SCTE-35 splice descriptor). Keys are
     * provider-defined.
     */
    readonly metadata?: Readonly<Record<string, string>>
}

/**
 * A single ad within an {@link AdBreakInfo}.
 */
export interface AdInfo {
    /** A stable identifier for this ad within its break. */
    readonly id: string

    /**
     * The start time of this ad on the media timeline, in seconds.
     */
    readonly startTime: number

    /**
     * The duration of this ad in seconds, or null when unknown.
     */
    readonly duration: number | null

    /**
     * The URI of the ad asset, when the source signal provides one directly
     * (e.g. an HLS interstitial `X-ASSET-URI`). Null when the ad is described
     * only indirectly.
     */
    readonly uri: string | null
}

/**
 * Events dispatched by an {@link AdController}. These are provider-agnostic:
 * an application listens once and receives the same events whether the ads
 * originate from HLS Interstitials or DASH SCTE-35.
 */
export interface AdEventMap {
    /**
     * Emitted when the set of known ad breaks for the current media changes,
     * for example when a live manifest reveals a new break.
     */
    readonly adBreaksChange: ChangeEvent<readonly AdBreakInfo[]>

    /**
     * Emitted when the playhead enters an ad break region.
     */
    readonly adBreakEnter: AdBreakInfo

    /**
     * Emitted when the playhead leaves an ad break region, whether because the
     * break played through, the user seeked past it, or the media changed.
     */
    readonly adBreakExit: AdBreakInfo
}

/**
 * Read-only view of the ad breaks for the current media and which break, if
 * any, currently contains the playhead.
 */
export interface ReadonlyAdController extends ReadonlyEventHost<AdEventMap> {
    /**
     * The ad breaks known for the current media, ordered by start time.
     */
    readonly adBreaks: readonly AdBreakInfo[]

    /**
     * The ad break currently containing the playhead, or null when the
     * playhead is in primary content.
     */
    readonly activeAdBreak: AdBreakInfo | null
}

/**
 * Tracks the ad breaks for the current media and reports when the playhead
 * enters and exits them.
 *
 * The controller is deliberately agnostic of HLS/DASH discovery details: its
 * input is a list of {@link AdBreakInfo} produced by a provider-specific
 * discovery step, and a playhead time fed via {@link updateTime}.
 */
export interface AdController extends ReadonlyAdController {
    /**
     * Replaces the known ad breaks. Emits `adBreaksChange` when the list
     * differs from the current one. If the active break is no longer present,
     * an `adBreakExit` is emitted for it.
     */
    setAdBreaks(adBreaks: readonly AdBreakInfo[]): void

    /**
     * Reports the current playhead time (seconds, media timeline). Emits
     * `adBreakEnter`/`adBreakExit` as the playhead crosses break boundaries.
     */
    updateTime(currentTime: number): void
}
