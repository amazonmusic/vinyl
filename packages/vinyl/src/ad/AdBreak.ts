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
 * Restrictions on user interaction during an ad break.
 */
export interface AdRestriction {
    /** When true, the user should not be allowed to skip this ad. */
    readonly skip?: boolean
    /** When true, the user should not be allowed to seek past this ad. */
    readonly jump?: boolean
}

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
     * Resolves the individual ad assets that make up this break, in playback
     * order. Returns a Promise so asset lists that are fetched asynchronously
     * (e.g. an HLS `X-ASSET-LIST`) can be resolved lazily on first access; the
     * result is cached by the resolver. For breaks whose assets are known up
     * front (e.g. an HLS `X-ASSET-URI`) the resolver returns them immediately.
     */
    readonly ads: () => Promise<readonly AdInfo[]>

    /**
     * Restrictions on user interaction during this ad break.
     */
    readonly restrict?: AdRestriction
}

/**
 * A single ad within an {@link AdBreakInfo}.
 */
export interface AdInfo {
    /** A stable identifier for this ad within its break. */
    readonly id: string

    /** The zero-based position of this ad within its break. */
    readonly index: number

    /** The total number of ads in this ad's break. */
    readonly totalAds: number

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
     * Emitted when the ad break containing the playhead changes: `current` is
     * the newly active break, or null when the playhead moves into primary
     * content (because the break played through, the user seeked past it, or
     * the media changed). `previous` is the break that was active before.
     */
    readonly adBreakChange: ChangeEvent<AdBreakInfo | null>
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

    /**
     * True when an ad is actively playing on the media element. While true,
     * playback events (ended, emptied, etc.) originate from the ad — not
     * from the content track. Consumers such as the TrackController should
     * not advance the queue in response to `ended` while this is true.
     */
    readonly adPlaying: boolean

    /**
     * The ad currently playing within the active break, or null.
     */
    readonly currentAd: AdInfo | null
}

/**
 * Tracks the ad breaks for the current media and reports when the playhead
 * enters and exits them.
 *
 * The controller is deliberately agnostic of HLS/DASH discovery details: its
 * input is a list of {@link AdBreakInfo} produced by a provider-specific
 * discovery step (via {@link setAdBreaks}); it derives the active break from
 * the playhead by observing the playback controller.
 */
export interface AdController extends ReadonlyAdController {
    /**
     * Replaces the known ad breaks. Emits `adBreaksChange` when the list
     * differs from the current one. If the active break is no longer present,
     * an `adBreakChange` to null is emitted for it.
     */
    setAdBreaks(adBreaks: readonly AdBreakInfo[]): void

    /**
     * Advances to the next ad in the active break, or skips the break
     * entirely if this was the last ad. Dispatches `adBreakChange` when
     * the break ends. No-op when no ad break is active.
     */
    advanceOrSkipAd(): void

    /**
     * Signals that the content track reached its natural end. If an unplayed
     * postroll break is scheduled at or after the content end, it is activated
     * (dispatching `adBreakChange`) and this returns true so the caller can
     * defer end-of-content handling until the postroll finishes. Returns false
     * when there is no pending postroll.
     */
    enterPostrollIfPending(): boolean

    /**
     * Skips the currently playing ad. If there are more ads in the break,
     * the next ad begins. If it's the last ad, the break ends.
     * No-op when no ad break is active.
     */
    skipAd(): void

    /**
     * Skips the entire active ad break, advancing past all remaining ads.
     * No-op when no ad break is active.
     */
    skipAdBreak(): void

    /**
     * Clears all ad state (known breaks, the active break, and skip history).
     * Called when the content changes, because break and ad ids are only unique
     * within a single presentation — retaining state across a media change
     * would let ids from the previous content collide with the new one. Emits
     * `adBreakChange` to null if a break was active.
     */
    reset(): void
}
