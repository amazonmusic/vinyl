/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type AlternativePresentationType,
    type DashManifest,
    type EventStreamType,
    type EventType,
    type MPDtype,
    parseDashManifest,
    type PeriodType,
    type Scte35Event,
    type Scte35SpliceInfoSectionType,
} from '@amazon/vinyl-mpd-parser'
import {
    type LogTarget,
    logWarn,
    memoize,
    readResponseBody,
    requestWithRetry,
    resolveUrl,
} from '@amazon/vinyl-util'
import type {
    AdBreakInfo,
    AdBreakList,
    AdBreakPlacement,
    AdInfo,
    AdList,
} from './AdBreakInfo'
import { classifyStitchedPlacement } from './stitchedAdBreak'
import { decodeSpliceInfoSectionText } from './scte35/decodeSpliceInfoSection'
import {
    getSpliceAvail,
    scte35TicksToSeconds,
    type SpliceDescriptor,
    type SpliceInfoSection,
} from './scte35/SpliceInfoSection'
import {
    calculatePeriodEnd,
    calculatePeriodStart,
} from '../track/dash/util/mpd'

/**
 * SCTE 214-1 MPD event schemes carrying SCTE-35.
 */
export const DashScte35Scheme = {
    /** The event body is SCTE-35 XML (`scte35:SpliceInfoSection`). */
    XML: 'urn:scte:scte35:2013:xml',
    /** The event body is a base64 `splice_info_section` in `scte35:Signal`. */
    XML_BIN: 'urn:scte:scte35:2014:xml+bin',
    /** The event body is a base64 `splice_info_section`. */
    BIN: 'urn:scte:scte35:2013:bin',
} as const

/**
 * ISO/IEC 23009-1 5.16 alternative MPD event schemes.
 */
export const DashAlternativeMpdScheme = {
    /** Pauses the main presentation to play the alternative presentation. */
    INSERT: 'urn:mpeg:dash:event:alternativeMPD:insert:2025',
    /** Plays the alternative presentation in place of a span of the main one. */
    REPLACE: 'urn:mpeg:dash:event:alternativeMPD:replace:2025',
} as const

const SCTE35_SCHEMES: ReadonlySet<string> = new Set([
    'urn:scte:scte35:2013:xml',
    'urn:scte:scte35:2014:xml+bin',
    'urn:scte:scte35:2013:bin',
])

const logTarget: LogTarget = {
    logPrefix: 'discoverDashAdBreaks',
}

/**
 * How close to the start or end of the presentation an alternative MPD event
 * must be to be classified as a pre-roll or post-roll, in seconds.
 */
const ROLL_EPSILON = 0.5

/**
 * Tolerance, in seconds, when matching Periods to a break's span.
 */
const SPAN_EPSILON = 0.1

type DashEvent = EventType & Scte35Event

/**
 * Discovers ad breaks from the MPD events of a DASH manifest and maps them to
 * {@link AdBreakInfo}.
 *
 * SCTE-35 events (SCTE 214-1 `urn:scte:scte35:2013:xml`,
 * `urn:scte:scte35:2014:xml+bin`, and `urn:scte:scte35:2013:bin`) signal
 * server-side (SSAI) ad avails stitched into the presentation, typically as
 * ad Periods. They become `stitched` breaks. Per DASH-IF IOP v5 Part 5, the
 * Event's `@presentationTime` and `@duration` give the avail's span; when the
 * Event has no duration, the SCTE-35 break or segmentation duration is used,
 * then the matching splice in. Each Period that starts within the break is
 * one of its ads.
 *
 * Alternative MPD events (ISO/IEC 23009-1 5.16, `InsertPresentation` and
 * `ReplacePresentation`) signal server-guided (SGAI) ads played as separate
 * presentations. They become `interstitial` breaks.
 *
 * @param manifest The parsed DASH manifest.
 * @param baseUrl The URL relative alternative MPD URIs resolve against.
 * @param presentationDuration The presentation duration in seconds, if known,
 *   used to classify post-rolls.
 */
export function discoverDashAdBreaks(
    manifest: DashManifest,
    baseUrl: string,
    presentationDuration?: number | null
): AdBreakList {
    const periods = manifest.MPD.Period
    const avails: Scte35Avail[] = []
    const breaks: AdBreakInfo[] = []
    for (const period of periods) {
        const periodStart = calculatePeriodStart(period)
        for (const eventStream of period.EventStream ?? []) {
            const { schemeIdUri } = eventStream
            const isScte35 = SCTE35_SCHEMES.has(schemeIdUri)
            const isInsert = schemeIdUri === DashAlternativeMpdScheme.INSERT
            const isReplace = schemeIdUri === DashAlternativeMpdScheme.REPLACE
            if (!isScte35 && !isInsert && !isReplace) continue
            const timescale = eventStream.timescale ?? 1
            for (const event of (eventStream.Event ?? []) as DashEvent[]) {
                const startTime =
                    periodStart +
                    (event.presentationTime -
                        (eventStream.presentationTimeOffset ?? 0)) /
                        timescale
                const duration =
                    event.duration != null ? event.duration / timescale : null
                if (isScte35) {
                    const avail = readScte35Avail(
                        eventStream,
                        event,
                        startTime,
                        duration
                    )
                    if (avail) avails.push(avail)
                } else {
                    const adBreak = createAlternativeMpdBreak({
                        eventStream,
                        event,
                        startTime,
                        duration,
                        baseUrl,
                        presentationDuration,
                    })
                    if (adBreak) breaks.push(adBreak)
                }
            }
        }
    }
    breaks.push(...createStitchedBreaks(avails, periods, presentationDuration))
    breaks.sort((a, b) => a.startTime - b.startTime)
    return breaks
}

interface Scte35Avail {
    readonly schemeIdUri: string
    readonly id: string
    readonly direction: 'out' | 'in'
    /** The SCTE-35 event id, matching an avail's out and in signals. */
    readonly eventId: number | null
    readonly startTime: number
    readonly duration: number | null
    readonly section: SpliceInfoSection | null
}

function readScte35Avail(
    eventStream: EventStreamType,
    event: DashEvent,
    startTime: number,
    eventDuration: number | null
): Scte35Avail | null {
    let section: SpliceInfoSection | null = null
    try {
        section = readSpliceInfoSection(eventStream.schemeIdUri, event)
    } catch (error) {
        logWarn(logTarget, `undecodable SCTE-35 event ${event.id}`, error)
    }
    const avail = section ? getSpliceAvail(section) : null
    // A section that is not an avail (e.g. a heartbeat or a non-advertising
    // segmentation type) is ignored; an undecodable one is placed by the
    // Event's own timing.
    if (section && !avail) return null
    const signalledDuration =
        avail?.duration != null ? scte35TicksToSeconds(avail.duration) : null
    return {
        schemeIdUri: eventStream.schemeIdUri,
        id: String(event.id ?? avail?.eventId ?? startTime),
        direction: avail?.direction ?? 'out',
        eventId: avail?.eventId ?? null,
        startTime,
        duration: eventDuration || signalledDuration,
        section,
    }
}

function readSpliceInfoSection(
    schemeIdUri: string,
    event: DashEvent
): SpliceInfoSection | null {
    const binary = event.Signal?.Binary?._content
    if (binary) return decodeSpliceInfoSectionText(binary)
    if (event.SpliceInfoSection)
        return spliceInfoSectionFromXml(event.SpliceInfoSection)
    if (schemeIdUri === DashScte35Scheme.BIN) {
        const text = event._content || event.messageData
        if (text) return decodeSpliceInfoSectionText(text)
    }
    return null
}

/**
 * Converts an SCTE-35 XML `SpliceInfoSection` to the binary section model.
 */
export function spliceInfoSectionFromXml(
    xml: Scte35SpliceInfoSectionType
): SpliceInfoSection {
    const descriptors: SpliceDescriptor[] = (
        xml.SegmentationDescriptor ?? []
    ).map((descriptor) => {
        const upid = descriptor.SegmentationUpid?.[0]
        return {
            type: 'segmentation',
            segmentationEventId: descriptor.segmentationEventId ?? 0,
            cancel: descriptor.segmentationEventCancelIndicator ?? false,
            segmentationDuration: descriptor.segmentationDuration ?? null,
            upidType: upid?.segmentationUpidType ?? 0,
            upid: upidBytes(upid?._content ?? '', upid?.segmentationUpidFormat),
            segmentationTypeId: descriptor.segmentationTypeId ?? 0,
            segmentNum: descriptor.segmentNum ?? 0,
            segmentsExpected: descriptor.segmentsExpected ?? 0,
        }
    })
    const base = {
        ptsAdjustment: xml.ptsAdjustment ?? 0,
        tier: xml.tier ?? 0xfff,
        encrypted: false,
        descriptors,
    }
    const insert = xml.SpliceInsert
    if (insert) {
        const breakDuration = insert.BreakDuration
        return {
            ...base,
            command: {
                type: 'spliceInsert',
                spliceEventId: insert.spliceEventId ?? 0,
                cancel: insert.spliceEventCancelIndicator ?? false,
                outOfNetwork: insert.outOfNetworkIndicator ?? false,
                spliceImmediate: insert.spliceImmediateFlag ?? false,
                spliceTime: insert.Program?.SpliceTime?.ptsTime ?? null,
                breakDuration:
                    breakDuration?.duration != null
                        ? {
                              autoReturn: breakDuration.autoReturn ?? false,
                              duration: breakDuration.duration,
                          }
                        : null,
                uniqueProgramId: insert.uniqueProgramId ?? 0,
                availNum: insert.availNum ?? 0,
                availsExpected: insert.availsExpected ?? 0,
            },
        }
    }
    if (xml.TimeSignal) {
        return {
            ...base,
            command: {
                type: 'timeSignal',
                spliceTime: xml.TimeSignal.SpliceTime?.ptsTime ?? null,
            },
        }
    }
    if (xml.SpliceNull) return { ...base, command: { type: 'spliceNull' } }
    return { ...base, command: { type: 'unknown', commandType: 0xff } }
}

function upidBytes(content: string, format: string | undefined): Uint8Array {
    const text = content.trim()
    if (format === 'text') return new TextEncoder().encode(text)
    const hex = text.replace(/^0x/i, '')
    if (!/^([0-9a-f]{2})*$/i.test(hex)) return new TextEncoder().encode(text)
    const out = new Uint8Array(hex.length / 2)
    for (let i = 0; i < out.length; i++)
        out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
    return out
}

/**
 * Pairs SCTE-35 out and in signals into stitched breaks, with an ad per
 * Period that starts within each break.
 */
function createStitchedBreaks(
    avails: readonly Scte35Avail[],
    periods: readonly PeriodType[],
    presentationDuration: number | null | undefined
): AdBreakInfo[] {
    const breaks: AdBreakInfo[] = []
    const seen = new Set<string>()
    for (const out of avails) {
        if (out.direction !== 'out') continue
        // The same avail may be repeated, e.g. in each ad Period of a pod.
        const key = `${out.eventId ?? out.id}@${out.startTime}`
        if (seen.has(key)) continue
        seen.add(key)
        const closing =
            out.eventId == null
                ? undefined
                : avails.find(
                      (avail) =>
                          avail.direction === 'in' &&
                          avail.eventId === out.eventId &&
                          avail.startTime > out.startTime
                  )
        const duration =
            out.duration ?? (closing ? closing.startTime - out.startTime : null)
        const sections = [out.section, closing?.section].filter(
            (section): section is SpliceInfoSection => section != null
        )
        breaks.push({
            id: out.id,
            startTime: out.startTime,
            duration,
            placement: classifyStitchedPlacement(
                out.startTime,
                duration,
                presentationDuration
            ),
            insertion: 'stitched',
            once: false,
            resumeOffset: duration,
            playoutLimit: null,
            resolutionTimeOffset: null,
            restrict: {},
            ads: periodAds(periods, out.id, out.startTime, duration),
            skipControl: null,
            signal: {
                source: 'dash-scte35',
                schemeIdUri: out.schemeIdUri,
                scte35: sections,
            },
        })
    }
    return breaks
}

/**
 * Returns an ad for each Period starting within the break, or a single ad
 * spanning the break when it is not delimited by Periods.
 */
function periodAds(
    periods: readonly PeriodType[],
    breakId: string,
    startTime: number,
    duration: number | null
): AdInfo[] {
    const endTime = duration == null ? Infinity : startTime + duration
    const ads: AdInfo[] = []
    for (const period of periods) {
        const periodStart = calculatePeriodStart(period)
        if (
            periodStart < startTime - SPAN_EPSILON ||
            periodStart >= endTime - SPAN_EPSILON
        )
            continue
        const periodEnd = Math.min(
            calculatePeriodEnd(period) ?? endTime,
            endTime
        )
        ads.push({
            id: period.id ?? `${breakId}-${ads.length}`,
            startTime: periodStart,
            duration: Number.isFinite(periodEnd)
                ? periodEnd - periodStart
                : null,
            uri: null,
        })
    }
    if (ads.length) return ads
    return [{ id: `${breakId}-0`, startTime, duration, uri: null }]
}

function createAlternativeMpdBreak({
    eventStream,
    event,
    startTime,
    duration,
    baseUrl,
    presentationDuration,
}: {
    readonly eventStream: EventStreamType
    readonly event: DashEvent
    readonly startTime: number
    readonly duration: number | null
    readonly baseUrl: string
    readonly presentationDuration: number | null | undefined
}): AdBreakInfo | null {
    const isReplace =
        eventStream.schemeIdUri === DashAlternativeMpdScheme.REPLACE
    const presentation: AlternativePresentationType | undefined = isReplace
        ? event.ReplacePresentation
        : event.InsertPresentation
    if (!presentation?.uri) {
        logWarn(logTarget, `alternative MPD event ${event.id} has no uri`)
        return null
    }
    const timescale = eventStream.timescale ?? 1
    const toSeconds = (value: number | undefined) =>
        value == null ? null : value / timescale
    const id = String(event.id ?? startTime)
    const playoutLimit = toSeconds(presentation.maxDuration)
    const uri = resolveUrl(presentation.uri, baseUrl)
    return {
        id,
        startTime,
        // A zero-length event (typical of an insert, which pauses the main
        // presentation) is a point in time: its span is unknown.
        duration: duration || null,
        placement: classifyAlternativeMpdPlacement(
            startTime,
            presentationDuration
        ),
        insertion: 'interstitial',
        once: false,
        // An insert pauses the main presentation: it resumes where it left off.
        // A replace resumes at its return offset, by default the event's end.
        resumeOffset: isReplace
            ? (toSeconds(presentation.returnOffset) ?? duration ?? 0)
            : 0,
        playoutLimit,
        resolutionTimeOffset: toSeconds(
            presentation.earliestResolutionTimeOffset
        ),
        restrict: {},
        // Resolved when the break is approached or entered.
        ads: memoize(() =>
            resolveAlternativePresentationAds({
                id,
                uri,
                startTime,
                playoutLimit,
            })
        ),
        skipControl: null,
        signal: {
            source: 'dash-alternative-mpd',
            schemeIdUri: eventStream.schemeIdUri,
            scte35: [],
        },
    }
}

/**
 * Resolves an alternative presentation's ads. A list MPD (`MPD@type="list"`),
 * such as an ad pod from an ad decision server, is one ad per Period, each
 * playing its imported MPD. Any other presentation, or one that cannot be
 * read here, is a single ad; its ad track reports any load failure.
 */
async function resolveAlternativePresentationAds({
    id,
    uri,
    startTime,
    playoutLimit,
}: {
    readonly id: string
    readonly uri: string
    readonly startTime: number
    readonly playoutLimit: number | null
}): Promise<AdList> {
    const single: AdList = [
        { id: `${id}-0`, startTime, duration: playoutLimit, uri },
    ]
    let mpd: MPDtype
    let documentUrl: string
    try {
        const response = await requestWithRetry(uri)
        documentUrl = response.url || uri
        mpd = parseDashManifest(await readResponseBody(response, 'text')).MPD
    } catch (error) {
        logWarn(logTarget, `alternative MPD ${uri} could not be read`, error)
        return single
    }
    if (mpd.type !== 'list') return single
    const ads: AdInfo[] = []
    for (const period of mpd.Period) {
        const imported = period.ImportedMPD?._content?.trim()
        if (!imported) continue
        ads.push({
            id: period.id ?? `${id}-${ads.length}`,
            startTime,
            duration: period.duration ?? null,
            uri: resolveUrl(imported, documentUrl),
        })
    }
    return ads
}

function classifyAlternativeMpdPlacement(
    startTime: number,
    presentationDuration: number | null | undefined
): AdBreakPlacement {
    if (startTime <= ROLL_EPSILON) return 'preroll'
    if (
        presentationDuration != null &&
        Number.isFinite(presentationDuration) &&
        startTime >= presentationDuration - ROLL_EPSILON
    )
        return 'postroll'
    return 'midroll'
}
