/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DateRange, MediaPlaylist } from '@amazon/vinyl-hls-parser'
import { HLS_INTERSTITIAL_CLASS } from '@amazon/vinyl-hls-parser'
import { resolveUrl, type Maybe } from '@amazon/vinyl-util'
import type {
    AdBreakInfo,
    AdBreakPlacement,
    AdInfo,
    AdRestriction,
} from './AdBreak'

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
        const cue = range.clientAttributes['CUE'] ?? ''
        const placement = classifyPlacement(
            startTime,
            duration,
            contentDuration,
            cue
        )
        const effectiveStartTime =
            cue === 'PRE' ? 0 : placement === 'preroll' ? 0 : startTime
        const ads = createAdsResolver(
            range,
            effectiveStartTime,
            duration,
            baseUrl
        )

        const restrictStr = range.clientAttributes['X-RESTRICT'] ?? ''
        const restrict = parseRestrict(restrictStr)

        breaks.push({
            id: range.id,
            startTime: effectiveStartTime,
            duration,
            placement,
            ads,
            ...(restrict && { restrict }),
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
 * Determines a break's duration in seconds. Uses X-PLAYOUT-LIMIT when present
 * (caps actual playback time), else DURATION, else END-DATE span, else
 * PLANNED-DURATION, else null.
 */
function resolveDuration(range: DateRange): number | null {
    const playoutLimit = parseFloat(
        range.clientAttributes['X-PLAYOUT-LIMIT'] ?? ''
    )
    if (Number.isFinite(playoutLimit) && playoutLimit > 0) {
        return playoutLimit
    }
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
    contentDuration: Maybe<number>,
    cue: string
): AdBreakPlacement {
    if (cue === 'PRE') return 'preroll'
    if (cue === 'POST') return 'postroll'
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
 * The JSON shape of an HLS interstitial `X-ASSET-LIST` document.
 */
interface AssetListDocument {
    readonly ASSETS?: readonly {
        readonly URI: string
        readonly DURATION?: number
    }[]
}

/**
 * Creates the {@link AdBreakInfo.ads} resolver for a break. An `X-ASSET-URI`
 * yields a single ad resolved immediately. An `X-ASSET-LIST` yields a resolver
 * that fetches the list JSON on first call and caches the result. When neither
 * is present the resolver yields an empty list.
 */
function createAdsResolver(
    range: DateRange,
    startTime: number,
    duration: number | null,
    baseUrl: string
): () => Promise<readonly AdInfo[]> {
    const assetUri = range.clientAttributes['X-ASSET-URI']
    if (assetUri) {
        const ads: readonly AdInfo[] = [
            {
                id: `${range.id}-0`,
                index: 0,
                totalAds: 1,
                startTime,
                duration,
                uri: resolveUrl(assetUri, baseUrl),
            },
        ]
        return () => Promise.resolve(ads)
    }

    const assetListUrl = range.clientAttributes['X-ASSET-LIST']
    if (assetListUrl) {
        const url = resolveUrl(assetListUrl, baseUrl)
        let cached: Promise<readonly AdInfo[]> | null = null
        return () => {
            if (cached) return cached
            cached = fetch(url)
                .then((res) => res.json())
                .then((json: AssetListDocument) => {
                    const assets = json.ASSETS ?? []
                    return assets.map(
                        (asset, i): AdInfo => ({
                            id: `${range.id}-${i}`,
                            index: i,
                            totalAds: assets.length,
                            startTime,
                            duration: asset.DURATION ?? null,
                            uri: resolveUrl(asset.URI, baseUrl),
                        })
                    )
                })
                .catch((error) => {
                    // Allow a later retry by clearing the cached rejection.
                    cached = null
                    throw error
                })
            return cached
        }
    }

    return () => Promise.resolve([])
}

function parseRestrict(str: string): AdRestriction | undefined {
    const skip = str.includes('SKIP')
    const jump = str.includes('JUMP')
    if (!skip && !jump) return undefined
    const result: { skip?: boolean; jump?: boolean } = {}
    if (skip) result.skip = true
    if (jump) result.jump = true
    return result
}
