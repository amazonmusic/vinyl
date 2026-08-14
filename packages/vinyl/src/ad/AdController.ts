/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChangeEvent } from '../event/ChangeEvent'
import { type Maybe, type ReadonlyEventHost } from '@amazon/vinyl-util'
import { type AdBreakInfo, type AdInfo, type TrackAds } from './AdBreakInfo'

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
     * Emitted when the current ad break changes.
     * An ad break may contain one or more ads.
     */
    readonly currentAdBreakChange: ChangeEvent<AdBreakInfo | null>

    /**
     * Dispatched when an ad region has been entered.
     */
    readonly adEntered: AdEvent

    /**
     * Dispatched when an ad has started playing.
     */
    readonly adPlaying: AdEvent

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
     * An ad list or an individual ad failed to load.
     * Will be dispatched after `adCompleted`.
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
    /** The ad that triggered this event. */
    readonly ad: AdInfo

    /** The zero-based position of this ad within its break. */
    readonly index: number

    /**
     * The total number of ads in this break.
     */
    readonly totalAds: number
}

export interface AdProgressEvent extends AdEvent {
    /**
     * The average continuous playback rate for the quartile.
     * Typically, 1.0 unless playbackRate was altered.
     */
    readonly playbackRateAvg: number
}

export interface AdCompleteEvent extends AdEvent {
    /** The current ad break. */
    readonly adBreak: AdBreakInfo

    /** The reason the ad changed, e.g. 'ended' for completed naturally, or 'skipped' */
    readonly reason: AdChangeReason

    /**
     * The absolute media-timeline position, in seconds, at which primary content
     * resumes after this break. The controller has already resolved the break's
     * resume offset and playout, so consumers use this position directly.
     */
    readonly resumePosition: number
}

export type AdChangeReason = 'ended' | 'skipped' | 'contentChange' | 'error'

export const ALL_AD_EVENTS = [
    'currentTrackAdsChange',
    'currentAdBreakChange',
    'adFirstQuartile',
    'adEntered',
    'adPlaying',
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
 * discovery step (via {@link setAds}); it derives the active break from
 * the playhead by observing the playback controller.
 */
export interface AdController extends ReadonlyAdController {
    /**
     * Clears the set of completed ad breaks, allowing them to be
     * played again.
     */
    clearCompletedAds(): void

    /**
     * Replaces the known ad breaks.
     * If there are preroll ad breaks they will be immediately set.
     *
     * @param value
     */
    setAds(value: Maybe<TrackAds>): void

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
     *
     * No-op when no ad break is active.
     */
    failAd(error: Error): void

    /**
     * Activates the next postroll ad.
     */
    enterPostroll(): void
}
