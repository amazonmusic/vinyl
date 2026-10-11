/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HlsDateRange, HlsMediaPlaylist } from '@amazon/vinyl-hls-parser'
import { HLS_INTERSTITIAL_CLASS } from '@amazon/vinyl-hls-parser'
import { logWarn, type LogTarget } from '@amazon/vinyl-util'
import type { AdBreakInfo, AdBreakList, AdInfo } from './AdBreakInfo'
import { classifyStitchedPlacement } from './stitchedAdBreak'
import { decodeSpliceInfoSectionText } from './scte35/decodeSpliceInfoSection'
import {
    getSpliceAvail,
    scte35TicksToSeconds,
    type SpliceInfoSection,
} from './scte35/SpliceInfoSection'

const SCTE35_ATTRIBUTES = ['SCTE35-OUT', 'SCTE35-CMD', 'SCTE35-IN'] as const

const logTarget: LogTarget = {
    logPrefix: 'discoverHlsScte35AdBreaks',
}

/**
 * Discovers stitched (SSAI) ad breaks signalled by SCTE-35 in HLS
 * `EXT-X-DATERANGE` tags and maps them to {@link AdBreakInfo}.
 *
 * Per RFC 8216 4.3.2.7.1, a splice out is a date range carrying `SCTE35-OUT`
 * and the matching splice in is a later date range with the same `ID` carrying
 * `SCTE35-IN` (and usually the now-known `DURATION` or `END-DATE`). A
 * `SCTE35-CMD` carries any other command; it opens an avail when it is a
 * `time_signal` with an advertising segmentation descriptor. The date ranges
 * sharing an ID are merged into one break.
 *
 * The break's duration is taken from `DURATION`, the `END-DATE` span,
 * `PLANNED-DURATION`, then the SCTE-35 break or segmentation duration. Within
 * the break, each discontinuity starts a new ad, as stitched ads are usually
 * separated by `EXT-X-DISCONTINUITY`.
 *
 * Wall-clock dates are mapped to the media timeline by the closest preceding
 * `EXT-X-PROGRAM-DATE-TIME`, which stitched playlists repeat after each
 * discontinuity. Breaks are skipped when the playlist has no program date
 * time.
 *
 * @param playlist The parsed HLS media playlist.
 * @param contentDuration The total duration in seconds, if known, used to
 *   classify post-rolls.
 */
export function discoverHlsScte35AdBreaks(
    playlist: HlsMediaPlaylist,
    contentDuration?: number | null
): AdBreakList {
    const timeline = createProgramDateTimeline(playlist)
    if (!timeline) return []

    const breaks: AdBreakInfo[] = []
    for (const ranges of groupScte35Ranges(playlist.dateRanges)) {
        const first = ranges[0]
        const epochMs = Date.parse(first.startDate)
        if (Number.isNaN(epochMs)) continue
        const sections: SpliceInfoSection[] = []
        let opens = false
        for (const range of ranges) {
            for (const attribute of SCTE35_ATTRIBUTES) {
                if (!(attribute in range.clientAttributes)) continue
                const text = range.clientAttributes[attribute]
                if (attribute === 'SCTE35-OUT') opens = true
                try {
                    const section = decodeSpliceInfoSectionText(text)
                    sections.push(section)
                    if (getSpliceAvail(section)?.direction === 'out')
                        opens = true
                } catch (error) {
                    logWarn(
                        logTarget,
                        `undecodable ${attribute} in date range ${range.id}`,
                        error
                    )
                }
            }
        }
        const duration = resolveDuration(ranges, sections)
        // A lone SCTE35-IN (its SCTE35-OUT already left a live window) still
        // places a break when its duration is known.
        if (!opens && duration == null) continue

        const startTime = Math.max(0, timeline.toMediaTime(epochMs))
        const placement = classifyStitchedPlacement(
            startTime,
            duration,
            contentDuration
        )
        const ads = splitAdsAtDiscontinuities(
            playlist,
            first.id,
            startTime,
            duration
        )
        breaks.push({
            id: first.id,
            startTime,
            duration,
            placement,
            insertion: 'stitched',
            once: false,
            resumeOffset: duration,
            playoutLimit: null,
            resolutionTimeOffset: null,
            restrict: {},
            ads,
            skipControl: null,
            signal: {
                source: 'hls-scte35',
                schemeIdUri: first.classId ?? null,
                scte35: sections,
            },
        })
    }
    breaks.sort((a, b) => a.startTime - b.startTime)
    return breaks
}

/**
 * Groups the SCTE-35 date ranges by ID, in playlist order.
 */
function groupScte35Ranges(
    dateRanges: readonly HlsDateRange[]
): HlsDateRange[][] {
    const groups = new Map<string, HlsDateRange[]>()
    for (const range of dateRanges) {
        if (range.classId === HLS_INTERSTITIAL_CLASS) continue
        if (
            !SCTE35_ATTRIBUTES.some(
                (attribute) => attribute in range.clientAttributes
            )
        )
            continue
        const group = groups.get(range.id)
        if (group) group.push(range)
        else groups.set(range.id, [range])
    }
    return [...groups.values()]
}

function resolveDuration(
    ranges: readonly HlsDateRange[],
    sections: readonly SpliceInfoSection[]
): number | null {
    for (const range of ranges) {
        if (range.duration != null && Number.isFinite(range.duration))
            return range.duration
    }
    for (const range of ranges) {
        if (range.endDate) {
            const span =
                (Date.parse(range.endDate) - Date.parse(range.startDate)) / 1000
            if (Number.isFinite(span) && span >= 0) return span
        }
    }
    for (const range of ranges) {
        if (
            range.plannedDuration != null &&
            Number.isFinite(range.plannedDuration)
        )
            return range.plannedDuration
    }
    for (const section of sections) {
        const avail = getSpliceAvail(section)
        if (avail?.direction === 'out' && avail.duration != null)
            return scte35TicksToSeconds(avail.duration)
    }
    return null
}

/**
 * Maps wall-clock times to the media timeline using every segment's
 * EXT-X-PROGRAM-DATE-TIME.
 */
interface ProgramDateTimeline {
    toMediaTime(epochMs: number): number
}

function createProgramDateTimeline(
    playlist: HlsMediaPlaylist
): ProgramDateTimeline | null {
    const anchors: { readonly epochMs: number; readonly mediaTime: number }[] =
        []
    let mediaTime = 0
    for (const segment of playlist.segments) {
        if (segment.programDateTime) {
            const epochMs = Date.parse(segment.programDateTime)
            if (!Number.isNaN(epochMs)) anchors.push({ epochMs, mediaTime })
        }
        mediaTime += segment.duration
    }
    if (!anchors.length) return null
    return {
        toMediaTime(epochMs) {
            // The closest anchor at or before the date, else the first.
            let anchor = anchors[0]
            let best = -Infinity
            for (const candidate of anchors) {
                if (candidate.epochMs <= epochMs && candidate.epochMs >= best) {
                    best = candidate.epochMs
                    anchor = candidate
                }
            }
            return anchor.mediaTime + (epochMs - anchor.epochMs) / 1000
        },
    }
}

/**
 * Tolerance, in seconds, when matching discontinuities to a break's span.
 */
const SPAN_EPSILON = 0.1

/**
 * Splits a break into one ad per discontinuity-delimited run of segments.
 */
function splitAdsAtDiscontinuities(
    playlist: HlsMediaPlaylist,
    breakId: string,
    startTime: number,
    duration: number | null
): AdInfo[] {
    // Without an end, the discontinuity returning to content is unknown.
    if (duration == null)
        return [{ id: `${breakId}-0`, startTime, duration, uri: null }]
    const endTime = startTime + duration
    const starts = [startTime]
    let mediaTime = 0
    for (const segment of playlist.segments) {
        if (
            segment.discontinuity &&
            mediaTime > startTime + SPAN_EPSILON &&
            mediaTime < endTime - SPAN_EPSILON
        ) {
            starts.push(mediaTime)
        }
        mediaTime += segment.duration
    }
    return starts.map((adStart, i): AdInfo => {
        const adEnd = starts[i + 1] ?? endTime
        return {
            id: `${breakId}-${i}`,
            startTime: adStart,
            duration: adEnd - adStart,
            uri: null,
        }
    })
}
