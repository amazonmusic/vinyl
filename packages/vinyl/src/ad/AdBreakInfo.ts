/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TrackUri } from '../track/Track'
import type { ValueProvider } from '@amazon/vinyl-util'

export interface TrackAds {
    /**
     * The URI of the parent track.
     */
    readonly trackUri: TrackUri

    /**
     * An array of the ad breaks for this track.
     */
    readonly adBreaks: AdBreakList
}

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
    /**
     * When true, the user should not be allowed to skip this ad.
     *
     * This is not enforced by the player; the application is expected
     * to respect this flag when showing ad skip controls.
     */
    readonly skip?: boolean

    /**
     * When true, the user should not be allowed to seek past this ad.
     */
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
 * be compared directly against the media's current time.
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
     */
    readonly ads: ValueProvider<AdList>

    /**
     * Restrictions on user interaction during this ad break.
     */
    readonly restrict: AdRestriction

    /**
     * When true, this break plays at most once for the presentation and is not
     * replayed even if the playhead re-crosses it (e.g. after a seek back). When
     * false, the break may replay each time the playhead re-enters its region.
     *
     * (An HLS interstitial sets this from a `CUE=ONCE` hint.)
     */
    readonly once: boolean

    /**
     * The offset, in seconds, from this break's scheduled {@link startTime} at
     * which primary content resumes after the break. A signed value: 0 resumes
     * in place (the break is purely additive). `null` means no resume offset was
     * specified, in which case content resumes advanced by the break's actual
     * playout duration (i.e. the break replaces that much primary content) —
     * this is distinct from an explicit 0.
     *
     * (An HLS interstitial sets this from `X-RESUME-OFFSET`.)
     */
    readonly resumeOffset: number | null

    /**
     * The maximum total playout time of the whole break, in seconds, summed
     * across all of its ads, or `null` when the break's playout is uncapped.
     * Distinct from {@link duration} (the break's timeline span) and from an
     * individual {@link AdInfo.duration}.
     *
     * (An HLS interstitial sets this from `X-PLAYOUT-LIMIT`.)
     */
    readonly playoutLimit: number | null
}

/**
 * An ad break list, sorted by start time ascendingly.
 */
export type AdBreakList = readonly AdBreakInfo[]

// TODO: skip control offset/duration
/**
 * A single ad within an {@link AdBreakInfo}.
 */
export interface AdInfo {
    /** A stable identifier for this ad within its break. */
    readonly id: string

    /** The start time of this ad on the media timeline, in seconds. */
    readonly startTime: number

    /** The duration of this ad in seconds, or null when unknown. */
    readonly duration: number | null

    /**
     * The URI of the ad asset, when the source signal provides one directly
     * (e.g. an HLS interstitial `X-ASSET-URI`). Null when the ad is described
     * only indirectly.
     */
    readonly uri: string | null
}

export type AdList = readonly AdInfo[]
