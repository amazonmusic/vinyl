/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Reads media timestamps from ISO-BMFF (fragmented MP4) segments.
 * @module
 */

/**
 * A presentation time range in a track's media timeline, in seconds.
 *
 * Sample presentation times are their decode times plus their composition
 * time offsets, less the edit list's media time, as MSE reports buffered
 * ranges.
 */
export interface MediaTimeRange {
    /**
     * The earliest presentation time of the samples.
     */
    readonly start: number

    /**
     * The latest presentation end time (presentation time plus duration) of
     * the samples.
     */
    readonly end: number
}

/**
 * Timing defaults from an initialization segment.
 */
export interface Mp4InitTiming {
    /**
     * The track's media timescale (`mdhd`), in units per second.
     */
    readonly timescale: number

    /**
     * The default sample duration (`trex`), used when a fragment declares none.
     */
    readonly defaultSampleDuration: number

    /**
     * The media time the presentation starts at, in timescale units: the
     * `media_time` of the first non-empty edit list (`elst`) entry, or 0
     * without one. Encoders use it to shift out the composition delay of
     * B-frames, so the first frame presents at 0. Empty edits (presentation
     * delays) aren't applied.
     */
    readonly editMediaTime: number
}

const CONTAINERS = new Set([
    'moov',
    'trak',
    'edts',
    'mdia',
    'mvex',
    'moof',
    'traf',
])

interface Box {
    readonly type: string
    /** Offset of the box payload (after the header). */
    readonly start: number
    /** Offset after the box. */
    readonly end: number
}

function readType(view: DataView, offset: number): string {
    return String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
    )
}

/**
 * Reads a 64-bit unsigned integer as a number, without BigInt (unavailable on
 * some legacy platforms). Exact below 2^53.
 */
function readUint64(view: DataView, offset: number): number {
    return view.getUint32(offset) * 0x100000000 + view.getUint32(offset + 4)
}

/**
 * Lists the child boxes in `[start, end)`.
 */
function children(view: DataView, start: number, end: number): Box[] {
    const out: Box[] = []
    let p = start
    while (p + 8 <= end) {
        let size = view.getUint32(p)
        const type = readType(view, p + 4)
        let header = 8
        if (size === 1) {
            size = readUint64(view, p + 8)
            header = 16
        } else if (size === 0) {
            size = end - p
        }
        if (size < header || p + size > end) break
        out.push({ type, start: p + header, end: p + size })
        p += size
    }
    return out
}

/**
 * Finds the first box at the given path, e.g. `['moov', 'trak', 'mdia']`.
 */
function find(
    view: DataView,
    path: readonly string[],
    start = 0,
    end = view.byteLength
): Box | null {
    const [type, ...rest] = path
    for (const box of children(view, start, end)) {
        if (box.type !== type) continue
        if (!rest.length) return box
        if (CONTAINERS.has(type)) {
            const found = find(view, rest, box.start, box.end)
            if (found) return found
        }
    }
    return null
}

/**
 * Reads a 64-bit signed integer as a number, without BigInt. Exact within
 * ±2^53.
 */
function readInt64(view: DataView, offset: number): number {
    return view.getInt32(offset) * 0x100000000 + view.getUint32(offset + 4)
}

/**
 * Returns the `media_time` of the first non-empty entry of an edit list
 * (`elst`), or 0 if it has none.
 */
function readEditMediaTime(view: DataView, elst: Box): number {
    const version = view.getUint8(elst.start)
    const entryCount = view.getUint32(elst.start + 4)
    const entrySize = version === 1 ? 20 : 12
    let p = elst.start + 8
    for (let i = 0; i < entryCount && p + entrySize <= elst.end; i++) {
        // segment_duration, then media_time; -1 marks an empty edit.
        const mediaTime =
            version === 1 ? readInt64(view, p + 8) : view.getInt32(p + 4)
        if (mediaTime >= 0) return mediaTime
        p += entrySize
    }
    return 0
}

/**
 * Reads the timescale, default sample duration, and edit list media time of
 * the first track in an initialization segment. Returns null if it isn't an
 * ISO-BMFF init segment.
 */
export function getMp4InitTiming(init: ArrayBuffer): Mp4InitTiming | null {
    try {
        const view = new DataView(init)
        const mdhd = find(view, ['moov', 'trak', 'mdia', 'mdhd'])
        if (!mdhd) return null
        const version = view.getUint8(mdhd.start)
        // version/flags, then creation and modification times.
        const timescale = view.getUint32(
            mdhd.start + 4 + (version === 1 ? 16 : 8)
        )
        if (!timescale) return null
        const trex = find(view, ['moov', 'mvex', 'trex'])
        // version/flags, track_ID, default_sample_description_index
        const defaultSampleDuration = trex ? view.getUint32(trex.start + 12) : 0
        const elst = find(view, ['moov', 'trak', 'edts', 'elst'])
        const editMediaTime = elst ? readEditMediaTime(view, elst) : 0
        return { timescale, defaultSampleDuration, editMediaTime }
    } catch {
        return null
    }
}

/**
 * Returns the media presentation time range covered by the fragments (`moof`)
 * in a media segment, in seconds. Returns null if the data has no fragments or
 * can't be read (e.g. WebM).
 *
 * Uses the first track fragment of each `moof`; segments for MSE carry one
 * track.
 */
export function getFragmentTimeRange(
    segment: ArrayBuffer,
    timing: Mp4InitTiming
): MediaTimeRange | null {
    try {
        const view = new DataView(segment)
        let start = Number.POSITIVE_INFINITY
        let end = Number.NEGATIVE_INFINITY
        for (const moof of children(view, 0, view.byteLength)) {
            if (moof.type !== 'moof') continue
            const traf = find(view, ['traf'], moof.start, moof.end)
            if (!traf) continue
            const range = readTrackFragment(view, traf, timing)
            if (!range) continue
            start = Math.min(start, range[0])
            end = Math.max(end, range[1])
        }
        if (start === Number.POSITIVE_INFINITY) return null
        const { editMediaTime, timescale } = timing
        return {
            start: (start - editMediaTime) / timescale,
            end: (end - editMediaTime) / timescale,
        }
    } catch {
        return null
    }
}

/**
 * Returns a track fragment's `[start, end]` presentation time in timescale
 * units.
 */
function readTrackFragment(
    view: DataView,
    traf: Box,
    timing: Mp4InitTiming
): [number, number] | null {
    let baseDecodeTime: number | null = null
    let defaultDuration = timing.defaultSampleDuration
    const truns: Box[] = []
    for (const box of children(view, traf.start, traf.end)) {
        const versionAndFlags = view.getUint32(box.start)
        const version = versionAndFlags >>> 24
        const flags = versionAndFlags & 0xffffff
        if (box.type === 'tfdt') {
            baseDecodeTime =
                version === 1
                    ? readUint64(view, box.start + 4)
                    : view.getUint32(box.start + 4)
        } else if (box.type === 'tfhd') {
            let p = box.start + 8 // version/flags, track_ID
            if (flags & 0x01) p += 8 // base_data_offset
            if (flags & 0x02) p += 4 // sample_description_index
            if (flags & 0x08) defaultDuration = view.getUint32(p)
        } else if (box.type === 'trun') {
            truns.push(box)
        }
    }
    if (baseDecodeTime === null) return null
    let decodeTime = baseDecodeTime
    let start = Number.POSITIVE_INFINITY
    let end = Number.NEGATIVE_INFINITY
    for (const trun of truns) {
        const versionAndFlags = view.getUint32(trun.start)
        const version = versionAndFlags >>> 24
        const flags = versionAndFlags & 0xffffff
        const sampleCount = view.getUint32(trun.start + 4)
        let p = trun.start + 8
        if (flags & 0x01) p += 4 // data_offset
        if (flags & 0x04) p += 4 // first_sample_flags
        const hasDuration = (flags & 0x100) !== 0
        const hasOffset = (flags & 0x800) !== 0
        if (!hasDuration && !hasOffset) {
            // Every sample starts at its decode time.
            if (sampleCount) {
                start = Math.min(start, decodeTime)
                decodeTime += sampleCount * defaultDuration
                end = Math.max(end, decodeTime)
            }
            continue
        }
        for (let i = 0; i < sampleCount; i++) {
            let duration = defaultDuration
            if (hasDuration) {
                duration = view.getUint32(p)
                p += 4
            }
            if (flags & 0x200) p += 4 // sample_size
            if (flags & 0x400) p += 4 // sample_flags
            let offset = 0
            if (hasOffset) {
                // Signed in version 1, unsigned in version 0.
                offset = version === 1 ? view.getInt32(p) : view.getUint32(p)
                p += 4
            }
            const presentationTime = decodeTime + offset
            start = Math.min(start, presentationTime)
            end = Math.max(end, presentationTime + duration)
            decodeTime += duration
        }
    }
    if (start === Number.POSITIVE_INFINITY) {
        // No samples: an empty range at the decode time.
        return [baseDecodeTime, baseDecodeTime]
    }
    return [start, end]
}
