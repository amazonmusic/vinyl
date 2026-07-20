/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DateRange, MediaPlaylist } from '@amazon/vinyl-hls-parser'
import { HLS_INTERSTITIAL_CLASS } from '@amazon/vinyl-hls-parser'
import { resolveUrl } from '@amazon/vinyl-util'
import type { AdBreakInfo, AdBreakPlacement, AdInfo } from './AdBreak'

/**
 * How close to the start or end of content a break must be to be classified as
 * a pre-roll or post-roll rather than a mid-roll, in seconds.
 */
const ROLL_EPSILON = 0.5

/**
 * Discovers HLS Interstitial ad breaks from a parsed media playlist and maps
 * them to the provider-agnostic {@link AdBreakInfo} model.
 *
 * HLS Interstitials (Apple's SGAI primitive) are carried as EXT-X-DATERANGE
 * tags with `CLASS="com.apple.hls.interstitial"`. Each such range is anchored
 * to a wall-clock `START-DATE`; this function converts that to a media-timeline
 * start time by correlating it with the playlist's EXT-X-PROGRAM-DATE-TIME
 * anchor. When the playlist carries no program date-time, and the range's
 * start-date is not otherwise resolvable, the break is anchored to the start of
 * the timeline (pre-roll) as a best effort.
 *
 * @param playlist The parsed HLS media playlist.
 * @param baseUrl  The URL of the media playlist, used to resolve relative
 *   `X-ASSET-URI` values.
 * @param contentDuration The total content duration in seconds, if known, used
 *   to classify post-rolls. Pass null/undefined for live or unknown durations.
 */
export function discoverHlsInterstitials(
    playlist: MediaPlaylist,
    baseUrl: string,
    contentDuration?: number | null
): readonly AdBreakInfo[] {
    const anchor = findProgramDateTimeAnchor(playlist)

    const breaks: AdBreakInfo[] = []
    for (const range of playlist.dateRanges) {
        if (range.classId !== HLS_INTERSTITIAL_CLASS) continue

        const startTime = resolveStartTime(range, anchor)
        if (startTime == null) continue

        const duration = resolveDuration(range)
        const placement = classifyPlacement(
            startTime,
            duration,
            contentDuration
        )
        const ads = resolveAds(range, startTime, duration, baseUrl)

        breaks.push({
            id: range.id,
            startTime,
            duration,
            placement,
            ads,
            ...(Object.keys(range.clientAttributes).length > 0 && {
                metadata: range.clientAttributes,
            }),
        })
    }

    breaks.sort((a, b) => a.startTime - b.startTime)
    return breaks
}

/**
 * The media-timeline anchor derived from the first segment carrying an
 * EXT-X-PROGRAM-DATE-TIME: the wall-clock epoch millis of that segment and the
 * media-timeline start time it corresponds to.
 */
interface ProgramDateTimeAnchor {
    readonly epochMs: number
    readonly mediaTime: number
}

function findProgramDateTimeAnchor(
    playlist: MediaPlaylist
): ProgramDateTimeAnchor | null {
    let mediaTime = 0
    for (const seg of playlist.segments) {
        if (seg.programDateTime) {
            const epochMs = Date.parse(seg.programDateTime)
            if (!Number.isNaN(epochMs)) {
                return { epochMs, mediaTime }
            }
        }
        mediaTime += seg.duration
    }
    return null
}

/**
 * Converts a range's wall-clock START-DATE to a media-timeline start time.
 * Returns 0 when there is no program-date-time anchor but the start-date is
 * present (best-effort pre-roll), or null when the start-date is unusable.
 */
function resolveStartTime(
    range: DateRange,
    anchor: ProgramDateTimeAnchor | null
): number | null {
    if (!range.startDate) {
        // END-ON-NEXT ranges may omit START-DATE; without an anchor we cannot
        // place them, so skip.
        return null
    }
    const epochMs = Date.parse(range.startDate)
    if (Number.isNaN(epochMs)) return null
    if (!anchor) {
        // No program-date-time to correlate against. Treat as a pre-roll.
        return 0
    }
    const startTime = anchor.mediaTime + (epochMs - anchor.epochMs) / 1000
    // Clamp tiny negatives from clock rounding to 0.
    return startTime < 0 && startTime > -ROLL_EPSILON ? 0 : startTime
}

/**
 * Determines a break's duration in seconds: DURATION when present, else the
 * span between END-DATE and START-DATE, else PLANNED-DURATION, else null.
 */
function resolveDuration(range: DateRange): number | null {
    if (range.duration != null && !Number.isNaN(range.duration)) {
        return range.duration
    }
    if (range.endDate && range.startDate) {
        const start = Date.parse(range.startDate)
        const end = Date.parse(range.endDate)
        if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
            return (end - start) / 1000
        }
    }
    if (range.plannedDuration != null && !Number.isNaN(range.plannedDuration)) {
        return range.plannedDuration
    }
    return null
}

function classifyPlacement(
    startTime: number,
    duration: number | null,
    contentDuration?: number | null
): AdBreakPlacement {
    if (startTime <= ROLL_EPSILON) return 'preroll'
    if (
        contentDuration != null &&
        Number.isFinite(contentDuration) &&
        startTime + (duration ?? 0) >= contentDuration - ROLL_EPSILON
    ) {
        return 'postroll'
    }
    return 'midroll'
}

/**
 * Resolves the ads within a break. An `X-ASSET-URI` yields a single ad. An
 * `X-ASSET-LIST` describes assets fetched asynchronously and so yields no ads
 * up front; callers may populate them later. Returns an empty list when
 * neither is present.
 */
function resolveAds(
    range: DateRange,
    startTime: number,
    duration: number | null,
    baseUrl: string
): readonly AdInfo[] {
    const assetUri = range.clientAttributes['X-ASSET-URI']
    if (assetUri) {
        return [
            {
                id: `${range.id}-0`,
                startTime,
                duration,
                uri: resolveUrl(assetUri, baseUrl),
            },
        ]
    }
    return []
}
