/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TrackUri } from '../track/Track'
import type { AdBreakInfo } from './AdBreakInfo'

export interface AdBreakResolverContext {
    /** The URI of the content track the break belongs to. */
    readonly trackUri: TrackUri
}

/**
 * Resolves a discovered ad break into the break the player uses. This is the
 * hook for ad decisioning, such as filling an avail from a VAST or VMAP ad
 * server: return the break with its {@link AdBreakInfo.ads} replaced by a
 * provider that requests and maps the ad server's response.
 *
 * An avail signalled for server-side insertion (a `stitched` break, e.g. from
 * SCTE-35) can be replaced client side by returning it as an `interstitial`
 * whose ads have URIs and whose {@link AdBreakInfo.resumeOffset} is the avail
 * duration, so content resumes after the avail.
 *
 * Called each time a track's ad breaks are read; the `ads` provider is
 * resolved lazily, when the break is approached or entered, so ad requests
 * are not made until needed. Return the break unchanged to keep it.
 */
export type AdBreakResolver = (
    adBreak: AdBreakInfo,
    context: AdBreakResolverContext
) => AdBreakInfo
