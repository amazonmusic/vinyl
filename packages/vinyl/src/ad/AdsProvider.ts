/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AnyRecord, ReadonlyEventHost } from '@amazon/vinyl-util'
import type { TrackAds } from './AdBreakInfo'

/**
 * Events dispatched by an {@link AdsProvider}.
 */
export interface AdsProviderEventMap {
    /**
     * The set of ads has changed; consumers should re-read via
     * {@link AdsProvider.getAds}.
     */
    readonly adsChange: AnyRecord
}

/**
 * The minimal surface an {@link AdController} needs to source its ad breaks:
 * a resolver for the current break list, plus an `adsChange` event to signal
 * when that list changes. A {@link ReadonlyTrack} satisfies this directly, so
 * the current playing track can be passed as-is; applications may also
 * implement it to supply ads out of band (e.g. from an external ad server).
 */
export interface AdsProvider extends ReadonlyEventHost<AdsProviderEventMap> {
    /**
     * Resolves to the provider's current ad breaks. The result may change over
     * the provider's lifetime; each `adsChange` event indicates that a
     * subsequent call may return different breaks.
     */
    getAds(): Promise<TrackAds>
}
