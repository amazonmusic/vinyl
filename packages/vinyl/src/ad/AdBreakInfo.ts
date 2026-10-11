/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TrackUri } from '../track/Track'
import type { ValueProvider } from '@amazon/vinyl-util'
import type { SpliceInfoSection } from './scte35/SpliceInfoSection'

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
 * How a break's ads are delivered.
 *
 *  - `interstitial` - each ad is a separate presentation (it has a
 *    {@link AdInfo.uri}) that the player switches to while primary content is
 *    paused, then switches back from. HLS Interstitials and DASH alternative MPD
 *    events are interstitials. This is server-guided (SGAI) or client-side ad
 *    insertion.
 *  - `stitched` - the ads are part of the content's own media timeline, as
 *    produced by server-side ad insertion (SSAI) such as AWS Elemental
 *    MediaTailor. The player plays straight through them; the break and its
 *    ads are tracked from the playhead.
 */
export type AdInsertion = 'interstitial' | 'stitched'

/**
 * The manifest signal an ad break was discovered from.
 *
 *  - `hls-interstitial` - an HLS `EXT-X-DATERANGE` with
 *    `CLASS="com.apple.hls.interstitial"`.
 *  - `hls-scte35` - an HLS `EXT-X-DATERANGE` with `SCTE35-OUT`, `SCTE35-IN`, or
 *    `SCTE35-CMD` attributes.
 *  - `dash-scte35` - a DASH MPD event in an SCTE 214 SCTE-35 scheme.
 *  - `dash-alternative-mpd` - a DASH alternative MPD insert or replace event
 *    (ISO/IEC 23009-1 5.16).
 */
export type AdBreakSource =
    'hls-interstitial' | 'hls-scte35' | 'dash-scte35' | 'dash-alternative-mpd'

/**
 * The manifest signal that described an ad break, for applications that need
 * more than the normalized {@link AdBreakInfo} fields, such as an ad decision
 * request built from the avail's SCTE-35 segmentation UPID.
 */
export interface AdBreakSignal {
    /** The kind of signal. */
    readonly source: AdBreakSource

    /**
     * The scheme that identified the signal: the DASH EventStream
     * `@schemeIdUri`, or the HLS date range `CLASS` (null when absent).
     */
    readonly schemeIdUri: string | null

    /**
     * The decoded SCTE-35 sections that delimit the break, in signalled order
     * (e.g. the `SCTE35-OUT` then `SCTE35-IN` of an HLS date range). Empty when
     * the signal carries no SCTE-35.
     */
    readonly scte35: readonly SpliceInfoSection[]
}

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
 * than primary content. The same shape is produced from HLS Interstitials,
 * HLS SCTE-35 date ranges, DASH SCTE-35 MPD events, and DASH alternative MPD
 * events, so applications observe one interface regardless of the streaming
 * protocol. See {@link signal} for the source signal.
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

    /**
     * How far ahead of this break's {@link startTime}, in seconds, the player
     * should resolve and preload the break's ad assets so they are ready when
     * the playhead reaches it. `null` when the source specifies no offset, in
     * which case the controller falls back to its `preloadAheadTime` option.
     * Applies to midroll and postroll breaks; prerolls are preloaded up front.
     *
     * (An HLS interstitial sets this from `X-RESOLUTION-TIME-OFFSET`.)
     */
    readonly resolutionTimeOffset: number | null

    /**
     * The window during which the user may skip this break, or a provider
     * resolving to `null` when the break carries no skip window (skippability is
     * then governed by {@link AdRestriction.skip}). Resolved lazily because, like
     * {@link ads}, it may require fetching the break's asset list.
     *
     * (An HLS interstitial sets this from the `X-ASSET-LIST` `SKIP-CONTROL`.)
     */
    readonly skipControl: ValueProvider<SkipControl | null>

    /**
     * How the break's ads are delivered. Absent is `interstitial`.
     */
    readonly insertion?: AdInsertion

    /**
     * The manifest signal the break was discovered from. Absent for breaks
     * supplied by an application.
     */
    readonly signal?: AdBreakSignal
}

/**
 * Returns true when the break's ads are stitched into the content timeline.
 */
export function isStitchedAdBreak(adBreak: AdBreakInfo): boolean {
    return adBreak.insertion === 'stitched'
}

/**
 * Describes when a user may skip an ad break: skipping becomes available
 * {@link offset} seconds into the break and remains offered for {@link duration}
 * seconds (or the rest of the break when null).
 */
export interface SkipControl {
    /** Seconds from the break start at which skipping becomes available. */
    readonly offset: number

    /**
     * Seconds the skip control remains offered after {@link offset}, or `null`
     * to offer it for the remainder of the break.
     */
    readonly duration: number | null
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

    /**
     * The start time of this ad on the media timeline, in seconds. For an
     * interstitial this is its break's start time; for a stitched ad it is
     * where the ad's media begins within the content.
     */
    readonly startTime: number

    /** The duration of this ad in seconds, or null when unknown. */
    readonly duration: number | null

    /**
     * The URI of the ad asset, when the source signal provides one directly
     * (e.g. an HLS interstitial `X-ASSET-URI`). Null when the ad is described
     * only indirectly, and for stitched ads, which play from the content.
     */
    readonly uri: TrackUri | null
}

export type AdList = readonly AdInfo[]
