/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChangeEvent } from '../event/ChangeEvent'
import { type ReadonlyEventHost } from '@amazon/vinyl-util'
import { type AdBreakInfo, type AdInfo, type TrackAds } from './AdBreakInfo'
import type { ReadonlyTrack } from '../track/Track'

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
    readonly currentTrackAdsChange: ChangeEvent<TrackAds | null>

    /**
     * Dispatched when the playhead approaches a midroll or postroll break —
     * within the break's resolution/preload window — so its ad assets can be
     * resolved and warmed ahead of entry. Fires once per break as it is
     * approached (again after a seek back re-arms a replayable break). Prerolls
     * are preloaded up front and do not emit this.
     */
    readonly adPreload: AdBreakEvent

    /**
     * Dispatched when an ad break has been entered — its ads may still be
     * resolving. An ad break may contain one or more ads.
     */
    readonly adBreakEntered: AdBreakEvent

    /**
     * Dispatched when the current ad break has completed: all of its ads
     * played, were skipped, it hit its playout limit, or it had no ads. Carries
     * the position at which primary content resumes.
     */
    readonly adBreakCompleted: AdBreakCompleteEvent

    /**
     * Dispatched when an ad region has been entered.
     */
    readonly adEntered: AdEvent

    /**
     * Dispatched when an ad has started playing.
     */
    readonly adPlaying: AdEvent

    /**
     * Dispatched on each playback progress tick while an ad is active, carrying
     * the elapsed and remaining time for both the current ad and the whole ad
     * break. Applications should prefer this over deriving ad timing from the
     * media element's duration.
     */
    readonly adTimeUpdate: AdTimeUpdateEvent

    /**
     * Dispatched when an ad has played through 25%.
     */
    readonly adFirstQuartile: AdProgressEvent

    /**
     * Dispatched when an ad has played through 50%.
     */
    readonly adMidpoint: AdProgressEvent

    /**
     * Dispatched when an ad has played through 75%.
     */
    readonly adThirdQuartile: AdProgressEvent

    /**
     * Dispatched when an ad has played through 100%.
     * Will be dispatched before adCompleted.
     */
    readonly adEnded: AdProgressEvent

    /**
     * Dispatched when an ad has stopped playing for any reason such as
     * ended, error, or skipped.
     */
    readonly adCompleted: AdCompleteEvent

    /**
     * An ad list or an individual ad failed to complete.
     */
    readonly adError: AdErrorEvent
}

export interface AdErrorEvent {
    /**
     * The current ad break when the ad failed to load.
     */
    readonly adBreak: AdBreakInfo

    /**
     * If set, the error was from an individual ad.
     * If not set, the failure was in loading the ad list.
     */
    readonly currentAd: AdInfo | null

    /**
     * The source error.
     */
    readonly error: any
}

export interface AdEvent {
    /** The parent ad break */
    readonly adBreak: AdBreakInfo

    /** The ad that triggered this event. */
    readonly ad: AdInfo

    /** The zero-based position of this ad within its break. */
    readonly index: number

    /** The total number of ads in this break. */
    readonly totalAds: number
}

export interface AdProgressEvent extends AdEvent {
    /**
     * The average continuous playback rate for the quartile.
     * Typically, 1.0 unless playbackRate was altered.
     */
    readonly playbackRateAvg: number
}

export interface AdTimeUpdateEvent extends AdEvent {
    /** Seconds the current ad has played. */
    readonly adCurrentTime: number

    /**
     * Seconds remaining in the current ad, or null when the ad's duration is
     * unknown.
     */
    readonly adTimeRemaining: number | null

    /**
     * Seconds the current ad break has played, summed across all of its ads so
     * far (including the current one).
     */
    readonly breakCurrentTime: number

    /**
     * Seconds remaining in the current ad break as a whole, or null when the
     * break's total duration is unknown.
     */
    readonly breakTimeRemaining: number | null

    /**
     * Whether the current ad may be skipped right now — false while skipping is
     * restricted or the break's skip window has not yet opened. Applications
     * should gate their skip control on this.
     */
    readonly canSkip: boolean

    /**
     * Seconds until the ad becomes skippable, or null when there is no pending
     * skip window (it is already skippable, or skipping is never offered).
     */
    readonly skipIn: number | null
}

export interface AdCompleteEvent extends AdEvent {
    /** The current ad break. */
    readonly adBreak: AdBreakInfo

    /** The reason the ad changed, e.g. 'ended' for completed naturally, or 'skipped' */
    readonly reason: AdChangeReason
}

export interface AdBreakEvent {
    /** The ad break. */
    readonly adBreak: AdBreakInfo
}

export interface AdBreakCompleteEvent extends AdBreakEvent {
    /**
     * The absolute media-timeline position, in seconds, at which primary content
     * resumes after this break. The controller has already resolved the break's
     * resume offset and playout, so consumers use this position directly.
     */
    readonly resumePosition: number

    /** The reason the ad break changed, e.g. 'ended' for completed naturally, or 'skipped' */
    readonly reason: AdChangeReason
}

export type AdChangeReason = 'ended' | 'skipped' | 'contentChange' | 'error'

export const ALL_AD_EVENTS = [
    'currentTrackAdsChange',
    'adPreload',
    'adBreakEntered',
    'adBreakCompleted',
    'adFirstQuartile',
    'adEntered',
    'adPlaying',
    'adTimeUpdate',
    'adMidpoint',
    'adThirdQuartile',
    'adEnded',
    'adCompleted',
    'adError',
] as const satisfies readonly (keyof AdEventMap)[]

/**
 * Read-only view of the ad breaks for the current media and which break, if
 * any, currently contains the playhead.
 */
export interface ReadonlyAdController extends ReadonlyEventHost<AdEventMap> {
    /**
     * The ad breaks known for the current media.
     */
    readonly currentTrackAds: TrackAds | null

    /**
     * The ad break currently containing the playhead, or null when the
     * playhead is in primary content.
     */
    readonly currentAdBreak: AdBreakInfo | null

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
 * discovery step and surfaced on the parent track (set via
 * {@link setParentTrack}); it derives the active break from the playhead by
 * observing the playback controller.
 */
export interface AdController extends ReadonlyAdController {
    /**
     * Sets the current active track, or null if no track is active.
     */
    setParentTrack(track: ReadonlyTrack | null): void

    /**
     * Skips the entire active ad break, advancing past all remaining ads.
     * No-op when no ad break is active.
     */
    skipAdBreak(): void

    /**
     * Skips the currently playing ad. If there are more ads in the break,
     * the next ad begins. If it's the last ad, the break ends.
     * No-op when no ad break is active.
     */
    skipAd(): void

    /**
     * Skips the current ad with 'error' for the completed reason.
     * Emits an 'adError' event.
     * If there are more ads in the break,
     * the next ad begins. If it's the last ad, the break ends.
     *
     * No-op when no ad break is active.
     */
    failAd(error: Error): void

    /**
     * Activates the preroll ads.
     * Does nothing if there is no preroll.
     * Resolves with the active preroll, or null if there wasn't one.
     */
    enterPreroll(): Promise<AdBreakInfo | null>

    /**
     * Activates the next postroll ad.
     * Does nothing if there is no postroll.
     * Resolves with the active postroll, or null if there wasn't one.
     */
    enterPostroll(): Promise<AdBreakInfo | null>
}
