/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseWebmCues, parseWebmInit } from '@amazon/vinyl-util'

/** Encodes `n` as an EBML size VINT (up to 4 bytes here). */
function vintSize(n: number): number[] {
    if (n < 0x80) return [0x80 | n]
    if (n < 0x4000) return [0x40 | (n >> 8), n & 0xff]
    if (n < 0x200000) return [0x20 | (n >> 16), (n >> 8) & 0xff, n & 0xff]
    return [0x10 | (n >> 24), (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/** Builds an EBML element: id bytes + size VINT + content. */
function el(id: readonly number[], content: readonly number[]): number[] {
    return [...id, ...vintSize(content.length), ...content]
}

const ID = {
    EBML: [0x1a, 0x45, 0xdf, 0xa3],
    Segment: [0x18, 0x53, 0x80, 0x67],
    Info: [0x15, 0x49, 0xa9, 0x66],
    TimecodeScale: [0x2a, 0xd7, 0xb1],
    Cues: [0x1c, 0x53, 0xbb, 0x6b],
    CuePoint: [0xbb],
    CueTime: [0xb3],
    CueTrackPositions: [0xb7],
    CueTrack: [0xf7],
    CueClusterPosition: [0xf1],
} as const

const toArrayBuffer = (bytes: number[]): ArrayBuffer =>
    new Uint8Array(bytes).buffer

function cuePoint(time: number[], clusterPosition: number[]): number[] {
    return el(ID.CuePoint, [
        ...el(ID.CueTime, time),
        ...el(ID.CueTrackPositions, [
            ...el(ID.CueTrack, [0x01]),
            ...el(ID.CueClusterPosition, clusterPosition),
        ]),
    ])
}

describe('parseWebmInit', () => {
    it('returns the Segment data offset and TimecodeScale', () => {
        // 1_000_000 = 0x0F4240
        const info = el(ID.Info, el(ID.TimecodeScale, [0x0f, 0x42, 0x40]))
        const init = [...el(ID.EBML, []), ...el(ID.Segment, info)]

        const result = parseWebmInit(toArrayBuffer(init))
        // EBML element is 5 bytes; Segment header (id 4 + size 1) is 5 more.
        expect(result.segmentDataStart).toBe(10)
        expect(result.timecodeScale).toBe(1_000_000)
        expect(result.segmentSize).toBe(info.length)
    })

    it('defaults TimecodeScale to 1ms when absent', () => {
        const init = [...el(ID.EBML, []), ...el(ID.Segment, el(ID.Info, []))]
        expect(parseWebmInit(toArrayBuffer(init)).timecodeScale).toBe(1_000_000)
    })

    it('throws when there is no Segment element (unknown-size top-level)', () => {
        // An EBML header with an "unknown size" (0xFF) leaves no bounded end,
        // so the top-level walk stops without finding a Segment.
        const init = [...ID.EBML, 0xff]
        expect(() => parseWebmInit(toArrayBuffer(init))).toThrowError(
            /missing Segment/
        )
    })

    it('skips non-TimecodeScale Info children and handles an unknown-size Segment', () => {
        const info = el(ID.Info, [
            ...el([0x44, 0x89], [0x00]), // Duration (ignored)
            ...el(ID.TimecodeScale, [0x0f, 0x42, 0x40]),
        ])
        // Segment with a 2-byte unknown size (0x7F 0xFF), bounded by the buffer.
        const init = [...el(ID.EBML, []), ...ID.Segment, 0x7f, 0xff, ...info]
        const result = parseWebmInit(toArrayBuffer(init))
        expect(result.timecodeScale).toBe(1_000_000)
        expect(result.segmentSize).toBeNull()
    })
})

describe('parseWebmCues', () => {
    it('parses cue times and cluster positions', () => {
        const cues = el(ID.Cues, [
            ...cuePoint([0x00], [0x00, 0x64]), // time 0, pos 100
            ...cuePoint([0x03, 0xe8], [0x00, 0xc8]), // time 1000, pos 200
        ])
        expect(parseWebmCues(toArrayBuffer(cues))).toEqual([
            { time: 0, clusterPosition: 100 },
            { time: 1000, clusterPosition: 200 },
        ])
    })

    it('throws when the first element is not a Cues element', () => {
        expect(() =>
            parseWebmCues(toArrayBuffer(el(ID.Info, [])))
        ).toThrowError(/expected WebM 'Cues'/)
    })

    it('throws on an invalid EBML variable-length integer', () => {
        // A leading 0x00 byte has no length-descriptor marker in 8 bytes.
        expect(() =>
            parseWebmCues(toArrayBuffer([0x00, 0x00, 0x00, 0x00]))
        ).toThrowError(/invalid EBML variable-length integer/)
    })

    it('defaults TimecodeScale when the Segment has no Info', () => {
        const init = [
            ...el(ID.EBML, []),
            // Segment with a non-Info child only.
            ...el(ID.Segment, el([0x11, 0x4d, 0x9b, 0x74], [0x00])),
        ]
        expect(parseWebmInit(toArrayBuffer(init)).timecodeScale).toBe(1_000_000)
    })

    it('handles an unknown-size Cues element', () => {
        // Cues with a 2-byte unknown size, bounded by the buffer.
        const cues = [...ID.Cues, 0x7f, 0xff, ...cuePoint([0x00], [0x00, 0x64])]
        expect(parseWebmCues(toArrayBuffer(cues))).toEqual([
            { time: 0, clusterPosition: 100 },
        ])
    })

    it('skips non-CuePoint and unknown-size entries within Cues', () => {
        const cues = el(ID.Cues, [
            ...el([0xec], [0x00]), // Void — not a CuePoint
            ...cuePoint([0x00], [0x00, 0x64]), // valid → { 0, 100 }
            // An unknown-size CuePoint (terminates the child list) — skipped.
            ...ID.CuePoint,
            0xff,
            ...el(ID.CueTime, [0x01]),
        ])
        expect(parseWebmCues(toArrayBuffer(cues))).toEqual([
            { time: 0, clusterPosition: 100 },
        ])
    })

    it('skips cue points missing a cluster position', () => {
        const cues = el(ID.Cues, [
            // CueTime but no CueTrackPositions.
            ...el(ID.CuePoint, el(ID.CueTime, [0x00])),
            // CueTrackPositions present but no CueClusterPosition.
            ...el(ID.CuePoint, [
                ...el(ID.CueTime, [0x01]),
                ...el(ID.CueTrackPositions, el(ID.CueTrack, [0x01])),
            ]),
        ])
        expect(parseWebmCues(toArrayBuffer(cues))).toEqual([])
    })
})
