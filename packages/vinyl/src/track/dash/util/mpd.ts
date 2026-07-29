/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { last, merge, sortedInsertionIndex } from '@amazon/vinyl-util'

import {
    type AdaptationSetType,
    type DashManifest,
    type MPDtype,
    type PeriodType,
    type RepresentationType,
    type SegmentBaseType,
    type SegmentListType,
    type SegmentTemplateType,
} from '@amazon/vinyl-mpd-parser'
import { getRepresentationMimeInfo } from './mimeType'

// TODO: For dynamic MPDs, availability time offsets should be summed.

/**
 * Calculates the inherited SegmentList for the given representation. Or returns undefined if no SegmentList is
 * present in the hierarchy.
 */
export function getSegmentList(
    representation: RepresentationType
): SegmentListType | undefined {
    return mergeIfAnyDefined(
        representation.parent.parent.SegmentList,
        representation.parent.SegmentList,
        representation.SegmentList
    )
}

/**
 * Calculates the inherited SegmentTemplate for the given representation. Or returns undefined if no SegmentTemplate is
 * present in the hierarchy.
 */
export function getSegmentTemplate(
    representation: RepresentationType
): SegmentTemplateType | undefined {
    return mergeIfAnyDefined(
        representation.parent.parent.SegmentTemplate,
        representation.parent.SegmentTemplate,
        representation.SegmentTemplate
    )
}

/**
 * Calculates the inherited SegmentBase for the given representation. Or returns undefined if no SegmentBase is
 * present in the hierarchy.
 */
export function getSegmentBase(
    representation: RepresentationType
): SegmentBaseType | undefined {
    return mergeIfAnyDefined(
        representation.parent.parent.SegmentBase,
        representation.parent.SegmentBase,
        representation.SegmentBase
    )
}

/**
 * Returns the representation's ancestry: [MPD, Period, AdaptationSet, Representation]
 */
export function getRepresentationAncestry(
    representation: RepresentationType
): readonly [MPDtype, PeriodType, AdaptationSetType, RepresentationType] {
    const adaptationSet = representation.parent
    const period = adaptationSet.parent
    const mpd = period.parent
    return [mpd, period, adaptationSet, representation]
}

/**
 * Merges the properties of all sources into a new object.
 * Used to calculate inherited properties.
 * If all sources are undefined, returns undefined.
 */
function mergeIfAnyDefined<T>(...sources: T[]): T | undefined {
    if (!sources.some((source) => source)) return undefined
    return merge(...sources)
}

export type PeriodRange = readonly [number, number | null]

/**
 * Calculates the period start and end time.
 */
export function calculatePeriodTimeRange(period: PeriodType): PeriodRange {
    return [calculatePeriodStart(period), calculatePeriodEnd(period)]
}

/**
 * Calculates the start time of the given period.
 *
 * In a static presentation, the first period SHALL start at the zero point of the MPD timeline (with a
 * Period@start value of 0 seconds).
 */
export function calculatePeriodStart(period: PeriodType): number {
    return period.start ?? 0
}

/**
 * In a static presentation, the last period SHALL have a Period@duration.
 *
 * In a dynamic presentation, the first period SHALL start at or after the zero point of the MPD timeline (with a
 *  Period@start value of 0 seconds or greater).
 *
 * In a dynamic presentation, the last period MAY have a Period@duration, in which case it has a fixed duration. If
 * without Period@duration, the last period in a dynamic presentation has an unlimited duration (that may later be
 * shortened by an MPD update).
 */
export function calculatePeriodEnd(period: PeriodType): number | null {
    if (period.start != null && period.duration != null)
        return period.start + period.duration

    const mpd = period.parent
    const periodIndex = mpd.Period.indexOf(period)
    if (periodIndex < mpd.Period.length - 1)
        return calculatePeriodStart(mpd.Period[periodIndex + 1])
    else return mpd.mediaPresentationDuration ?? null
}

/**
 * Converts a sample time to an MPD-relative time.
 *
 * The samples within a representation exist on a linear sample timeline defined by the encoder. This function maps
 * those sample times onto the MPD timeline.
 *
 * https://dashif-documents.azurewebsites.net/Guidelines-TimingModel/master/Guidelines-TimingModel.html
 *
 * @param sampleTime The sample start time, in timescale units, relative to the media.
 * @param periodStart The presentation start time of the period, relative to the MPD timeline.
 * @param presentationTimeOffset Specifies a presentation time offset in the media timeline relative to the start
 * of the Period, in timescale units, used to adjust the timing of media presentation.
 * @param timescale The timescale, in units per second.
 */
export function sampleToMpdTime(
    sampleTime: number,
    periodStart: number,
    presentationTimeOffset: number,
    timescale: number
): number {
    return periodStart + (sampleTime - presentationTimeOffset) / timescale
}

/**
 * Gets the period spanning the given presentation time.
 */
export function getPeriodAtTime(
    manifest: DashManifest,
    time: number
): PeriodType | null {
    const index =
        sortedInsertionIndex(manifest.MPD.Period, time, (time, period) => {
            return time - calculatePeriodStart(period)
        }) - 1
    if (index < 0) return null
    const period = manifest.MPD.Period[index]
    const periodEnd = calculatePeriodEnd(period)
    return periodEnd != null && time >= periodEnd ? null : period
}

/**
 * Flattens representations across all adaptation sets for the given Period.
 */
export function flattenRepresentations(
    period: PeriodType
): RepresentationType[] {
    const out: RepresentationType[] = []
    period.AdaptationSet?.forEach((adaptationSet) => {
        adaptationSet.Representation?.forEach((representation) => {
            out.push(representation)
        })
    })
    return out
}

/**
 * Flattens the representations across all adaptation sets for the given Period
 * that the MSE media pipeline can play, i.e. `audio` and `video`.
 *
 * Text adaptation sets (e.g. `contentType="text"` WebVTT sidecar subtitles) are
 * excluded: they are surfaced through the sidecar text-track pipeline
 * (`discoverDashTextTracks`), not buffered through MSE, so including them here
 * would create an unplayable text SourceBuffer and stall playback.
 */
export function flattenMediaRepresentations(
    period: PeriodType
): RepresentationType[] {
    return flattenRepresentations(period).filter((representation) => {
        const { contentType } = getRepresentationMimeInfo(representation)
        return contentType === 'audio' || contentType === 'video'
    })
}

/**
 * Calculates the manifest duration, either from the mediaPresentationDuration or the last period end time.
 * Returns `Infinity` for live (dynamic) presentations.
 * Throws if duration cannot be determined.
 */
export function calculateDuration(manifest: DashManifest): number {
    if (manifest.MPD.type === 'dynamic') return Infinity
    const mpdDuration = manifest.MPD.mediaPresentationDuration
    if (mpdDuration != null) return mpdDuration
    const lastPeriod = last(manifest.MPD.Period)
    if (!lastPeriod) {
        throw new Error('Unable to determine manifest duration: no periods')
    }
    const end = calculatePeriodEnd(lastPeriod)
    if (end == null) {
        throw new Error('Unable to determine manifest duration')
    }
    return end
}
