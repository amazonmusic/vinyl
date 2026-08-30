/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ValidationError } from '../../error/ValidationError'
import { ErrorOrigin } from '../../error/ErrorOrigin'

/**
 * A minimal EBML/Matroska (WebM) parser: just enough to index a DASH
 * `SegmentBase` WebM stream — the `Segment` data offset and `TimecodeScale`
 * from the initialization segment, and the `CuePoint`s from the `Cues` element
 * (the WebM equivalent of an ISO-BMFF `sidx`).
 *
 * @module
 */

/** EBML element IDs (with their length-descriptor marker bits intact). */
const EBML_ID = {
    Segment: 0x18538067,
    Info: 0x1549a966,
    TimecodeScale: 0x2ad7b1,
    Cues: 0x1c53bb6b,
    CuePoint: 0xbb,
    CueTime: 0xb3,
    CueTrackPositions: 0xb7,
    CueClusterPosition: 0xf1,
} as const

/** The default `TimecodeScale` (1ms in nanoseconds) when none is present. */
export const DEFAULT_WEBM_TIMECODE_SCALE = 1_000_000

/**
 * A parsed EBML element header: its id, the absolute offset of its content, and
 * the content size (or `null` for the reserved "unknown size" encoding, in
 * which case `end` is also `null`).
 */
interface ElementHeader {
    readonly id: number
    readonly contentStart: number
    readonly size: number | null
    readonly end: number | null
}

/**
 * Reads an EBML variable-length integer at `pos`.
 *
 * @param keepMarker When true (element ids), the leading length-descriptor
 * marker bit is retained; when false (sizes/uints), it is stripped to yield the
 * numeric value, and an all-ones value ("unknown size") yields `null`.
 */
function readVint(
    view: DataView,
    pos: number,
    keepMarker: boolean
): { value: number | null; length: number } {
    const first = view.getUint8(pos)
    let mask = 0x80
    let length = 1
    while (length <= 8 && (first & mask) === 0) {
        mask >>= 1
        length++
    }
    if (length > 8)
        throw new ValidationError(
            'invalid EBML variable-length integer',
            ErrorOrigin.MEDIA
        )

    let value = keepMarker ? first : first & (mask - 1)
    let allOnes = (first & (mask - 1)) === mask - 1
    for (let i = 1; i < length; i++) {
        const byte = view.getUint8(pos + i)
        allOnes = allOnes && byte === 0xff
        // Multiply (not shift) to stay correct beyond 32 bits.
        value = value * 256 + byte
    }
    return { value: !keepMarker && allOnes ? null : value, length }
}

/**
 * Reads the EBML element header at `pos`.
 */
function readElementHeader(view: DataView, pos: number): ElementHeader {
    const { value: id, length: idLength } = readVint(view, pos, true)
    const { value: size, length: sizeLength } = readVint(
        view,
        pos + idLength,
        false
    )
    const contentStart = pos + idLength + sizeLength
    return {
        id: id!,
        contentStart,
        size,
        end: size == null ? null : contentStart + size,
    }
}

/**
 * Reads the child element headers in `[start, end)`. An unknown-size element
 * (no bounded end) terminates the list.
 */
function childHeaders(
    view: DataView,
    start: number,
    end: number
): readonly ElementHeader[] {
    const out: ElementHeader[] = []
    let pos = start
    while (pos < end) {
        const el = readElementHeader(view, pos)
        out.push(el)
        if (el.end == null) break
        pos = el.end
    }
    return out
}

/**
 * Reads a big-endian unsigned integer of `length` bytes at `pos`.
 */
function readUint(view: DataView, pos: number, length: number): number {
    let value = 0
    for (let i = 0; i < length; i++)
        value = value * 256 + view.getUint8(pos + i)
    return value
}

export interface WebmInitInfo {
    /**
     * The absolute byte offset (in the file) where the `Segment` element's
     * content begins. `CueClusterPosition` values are relative to this.
     */
    readonly segmentDataStart: number

    /**
     * The `Segment` content size in bytes, or `null` if encoded as unknown.
     */
    readonly segmentSize: number | null

    /**
     * The `TimecodeScale` in nanoseconds per tick (cue times are in these ticks).
     */
    readonly timecodeScale: number
}

/**
 * Parses a WebM initialization segment for the `Segment` data offset and
 * `TimecodeScale`. The init segment is everything before the first `Cluster`
 * (EBML header, `Segment` header, `SeekHead`, `Info`, `Tracks`).
 */
export function parseWebmInit(buffer: ArrayBuffer): WebmInitInfo {
    const view = new DataView(buffer)
    const segment = childHeaders(view, 0, view.byteLength).find(
        (el) => el.id === EBML_ID.Segment
    )
    if (!segment)
        throw new ValidationError(
            'WebM init segment missing Segment element',
            ErrorOrigin.MEDIA
        )

    const segmentEnd = Math.min(segment.end ?? view.byteLength, view.byteLength)
    const info = childHeaders(view, segment.contentStart, segmentEnd).find(
        (el) => el.id === EBML_ID.Info && el.size != null
    )
    return {
        segmentDataStart: segment.contentStart,
        segmentSize: segment.size,
        timecodeScale: info
            ? readTimecodeScale(view, info.contentStart, info.end!)
            : DEFAULT_WEBM_TIMECODE_SCALE,
    }
}

/**
 * Reads `Info > TimecodeScale`, defaulting when absent.
 */
function readTimecodeScale(view: DataView, start: number, end: number): number {
    const el = childHeaders(view, start, end).find(
        (child) => child.id === EBML_ID.TimecodeScale && child.size
    )
    return el
        ? readUint(view, el.contentStart, el.size!)
        : DEFAULT_WEBM_TIMECODE_SCALE
}

/**
 * A single WebM cue point: a cluster's start time and its byte offset relative
 * to the `Segment` data start.
 */
export interface WebmCuePoint {
    /**
     * The cluster's start time, in `TimecodeScale` ticks.
     */
    readonly time: number

    /**
     * The cluster's byte offset relative to the `Segment` data start.
     */
    readonly clusterPosition: number
}

/**
 * Parses a WebM `Cues` element (as located by a DASH `SegmentBase@indexRange`)
 * into its cue points, in order.
 */
export function parseWebmCues(buffer: ArrayBuffer): readonly WebmCuePoint[] {
    const view = new DataView(buffer)
    const cues = readElementHeader(view, 0)
    if (cues.id !== EBML_ID.Cues)
        throw new ValidationError(
            `expected WebM 'Cues' element but had id: 0x${cues.id.toString(16)}`,
            ErrorOrigin.MEDIA
        )
    const cuesEnd = Math.min(cues.end ?? view.byteLength, view.byteLength)

    const cuePoints: WebmCuePoint[] = []
    for (const el of childHeaders(view, cues.contentStart, cuesEnd)) {
        if (el.id !== EBML_ID.CuePoint || el.size == null) continue
        const cuePoint = parseCuePoint(view, el.contentStart, el.end!)
        if (cuePoint) cuePoints.push(cuePoint)
    }
    return cuePoints
}

/**
 * Parses a single `CuePoint` (its `CueTime` and first
 * `CueTrackPositions > CueClusterPosition`).
 */
function parseCuePoint(
    view: DataView,
    start: number,
    end: number
): WebmCuePoint | null {
    let time: number | null = null
    let clusterPosition: number | null = null
    for (const el of childHeaders(view, start, end)) {
        if (el.id === EBML_ID.CueTime && el.size)
            time = readUint(view, el.contentStart, el.size)
        else if (el.id === EBML_ID.CueTrackPositions && el.size != null)
            clusterPosition = readCueClusterPosition(
                view,
                el.contentStart,
                el.end!
            )
    }
    return time != null && clusterPosition != null
        ? { time, clusterPosition }
        : null
}

/**
 * Reads `CueTrackPositions > CueClusterPosition`.
 */
function readCueClusterPosition(
    view: DataView,
    start: number,
    end: number
): number | null {
    const el = childHeaders(view, start, end).find(
        (child) => child.id === EBML_ID.CueClusterPosition && child.size
    )
    return el ? readUint(view, el.contentStart, el.size!) : null
}
