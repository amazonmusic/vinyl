/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { getFragmentTimeRange, getMp4InitTiming } from '@amazon/vinyl-util'
import { shakaPackagerSegments as shaka } from './shakaPackagerSegments'

function concat(...parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
    let offset = 0
    for (const part of parts) {
        out.set(part, offset)
        offset += part.length
    }
    return out
}

function uint32(...values: readonly number[]): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(values.length * 4)
    const view = new DataView(out.buffer)
    values.forEach((v, i) => view.setUint32(i * 4, v))
    return out
}

function fourCC(type: string): Uint8Array<ArrayBuffer> {
    return new Uint8Array([0, 1, 2, 3].map((i) => type.charCodeAt(i)))
}

function box(
    type: string,
    ...payload: readonly Uint8Array[]
): Uint8Array<ArrayBuffer> {
    const body = concat(...payload)
    const header = uint32(8 + body.length)
    return concat(header, fourCC(type), body)
}

/** A full box: version (8 bits) and flags (24 bits), then the payload. */
function fullBox(
    type: string,
    version: number,
    flags: number,
    ...payload: readonly Uint8Array[]
): Uint8Array<ArrayBuffer> {
    return box(type, uint32(((version << 24) | flags) >>> 0), ...payload)
}

function init(
    timescale: number,
    trexDuration?: number,
    elst?: Uint8Array
): ArrayBuffer {
    const mdhd = fullBox('mdhd', 0, 0, uint32(0, 0, timescale, 0, 0))
    const edts = elst ? box('edts', elst) : new Uint8Array(0)
    const trak = box('trak', edts, box('mdia', mdhd))
    const mvex =
        trexDuration == null
            ? new Uint8Array(0)
            : box(
                  'mvex',
                  fullBox('trex', 0, 0, uint32(1, 1, trexDuration, 0, 0))
              )
    return concat(box('ftyp', uint32(0)), box('moov', trak, mvex)).buffer
}

function moof(options: {
    readonly decodeTime: number
    readonly durations?: readonly number[]
    readonly sampleCount?: number
    readonly tfhdDuration?: number
    readonly tfdtVersion?: 0 | 1
}): Uint8Array<ArrayBuffer> {
    const tfhd =
        options.tfhdDuration == null
            ? fullBox('tfhd', 0, 0, uint32(1))
            : fullBox('tfhd', 0, 0x08, uint32(1, options.tfhdDuration))
    const tfdt =
        options.tfdtVersion === 1
            ? fullBox(
                  'tfdt',
                  1,
                  0,
                  uint32(
                      Math.floor(options.decodeTime / 0x100000000),
                      options.decodeTime >>> 0
                  )
              )
            : fullBox('tfdt', 0, 0, uint32(options.decodeTime))
    let trun: Uint8Array
    if (options.durations) {
        // data_offset, sample_duration and sample_size present.
        const samples = options.durations.flatMap((d) => [d, 100])
        trun = fullBox(
            'trun',
            0,
            0x301,
            uint32(options.durations.length, 0, ...samples)
        )
    } else {
        trun = fullBox('trun', 0, 0, uint32(options.sampleCount ?? 0))
    }
    return box(
        'moof',
        fullBox('mfhd', 0, 0, uint32(1)),
        box('traf', tfhd, tfdt, trun)
    )
}

function segment(...moofs: readonly Uint8Array[]): ArrayBuffer {
    return concat(...moofs.flatMap((m) => [m, box('mdat', uint32(0))])).buffer
}

describe('fragmentTime', () => {
    describe('getMp4InitTiming', () => {
        it('reads the mdhd timescale and trex default duration', () => {
            expect(getMp4InitTiming(init(15360, 512))).toEqual({
                timescale: 15360,
                defaultSampleDuration: 512,
                editMediaTime: 0,
            })
        })

        it('defaults the sample duration to 0 without a trex', () => {
            expect(getMp4InitTiming(init(48000))).toEqual({
                timescale: 48000,
                defaultSampleDuration: 0,
                editMediaTime: 0,
            })
        })

        it('reads the media time of a version 0 edit list', () => {
            // segment_duration, media_time, media_rate 1.0, as shaka-packager
            // writes to shift out a 2-frame B-frame delay at 30 fps.
            const elst = fullBox('elst', 0, 0, uint32(1, 0, 1024, 0x10000))
            expect(getMp4InitTiming(init(15360, 512, elst))).toEqual({
                timescale: 15360,
                defaultSampleDuration: 512,
                editMediaTime: 1024,
            })
        })

        it('reads the media time of a version 1 edit list', () => {
            const elst = fullBox(
                'elst',
                1,
                0,
                uint32(1, 0, 0, 0, 2048, 0x10000)
            )
            expect(
                getMp4InitTiming(init(15360, 512, elst))?.editMediaTime
            ).toBe(2048)
        })

        it('skips empty edits', () => {
            // An empty edit (media_time -1), then the edit that plays media.
            const elst = fullBox(
                'elst',
                0,
                0,
                uint32(2, 100, 0xffffffff, 0x10000, 0, 512, 0x10000)
            )
            expect(
                getMp4InitTiming(init(15360, 512, elst))?.editMediaTime
            ).toBe(512)
        })

        it('skips version 1 empty edits', () => {
            // segment_duration and a 64-bit media_time of -1, then the edit
            // that plays media.
            const elst = fullBox(
                'elst',
                1,
                0,
                uint32(2, 0, 100, 0xffffffff, 0xffffffff, 0x10000),
                uint32(0, 0, 0, 512, 0x10000)
            )
            expect(
                getMp4InitTiming(init(15360, 512, elst))?.editMediaTime
            ).toBe(512)
        })

        it('reads every value from the first track', () => {
            // The first track has no edit list; the second's isn't used.
            const elst = fullBox('elst', 0, 0, uint32(1, 0, 1024, 0x10000))
            const trak1 = box(
                'trak',
                fullBox('tkhd', 0, 0, uint32(0, 0, 2)),
                box('mdia', fullBox('mdhd', 0, 0, uint32(0, 0, 48000, 0, 0)))
            )
            const trak2 = box(
                'trak',
                fullBox('tkhd', 0, 0, uint32(0, 0, 1)),
                box('edts', elst),
                box('mdia', fullBox('mdhd', 0, 0, uint32(0, 0, 15360, 0, 0)))
            )
            const mvex = box(
                'mvex',
                fullBox('trex', 0, 0, uint32(1, 1, 512, 0, 0)),
                fullBox('trex', 0, 0, uint32(2, 1, 1024, 0, 0))
            )
            const data = concat(
                box('ftyp', uint32(0)),
                box('moov', trak1, trak2, mvex)
            ).buffer
            expect(getMp4InitTiming(data)).toEqual({
                timescale: 48000,
                defaultSampleDuration: 1024,
                editMediaTime: 0,
            })
        })

        it('uses the first trex if none matches the track', () => {
            // A version 1 tkhd for track 3, then mvex with mehd and the
            // trex of other tracks.
            const trak = box(
                'trak',
                fullBox('tkhd', 1, 0, uint32(0, 0, 0, 0, 3)),
                box('mdia', fullBox('mdhd', 0, 0, uint32(0, 0, 15360, 0, 0)))
            )
            const mvex = box(
                'mvex',
                fullBox('mehd', 0, 0, uint32(0)),
                fullBox('trex', 0, 0, uint32(1, 1, 512, 0, 0)),
                fullBox('trex', 0, 0, uint32(2, 1, 1024, 0, 0))
            )
            const data = concat(
                box('ftyp', uint32(0)),
                box('moov', trak, mvex)
            ).buffer
            expect(getMp4InitTiming(data)?.defaultSampleDuration).toBe(512)
        })

        it('returns 0 for an edit list of only empty edits', () => {
            const elst = fullBox(
                'elst',
                0,
                0,
                uint32(1, 100, 0xffffffff, 0x10000)
            )
            expect(
                getMp4InitTiming(init(15360, 512, elst))?.editMediaTime
            ).toBe(0)
        })

        it('returns 0 for an edit list of an unknown version', () => {
            const elst = fullBox('elst', 2, 0, uint32(1, 0, 1024, 0x10000))
            expect(
                getMp4InitTiming(init(15360, 512, elst))?.editMediaTime
            ).toBe(0)
        })

        it('returns 0 for a truncated edit list', () => {
            // Declares an entry it doesn't contain.
            const elst = fullBox('elst', 0, 0, uint32(1))
            expect(
                getMp4InitTiming(init(15360, 512, elst))?.editMediaTime
            ).toBe(0)
        })

        it('returns null for data that is not an mp4 init segment', () => {
            expect(getMp4InitTiming(new Uint8Array(64).buffer)).toBeNull()
            expect(getMp4InitTiming(new ArrayBuffer(0))).toBeNull()
        })
    })

    describe('getFragmentTimeRange', () => {
        const timing = {
            timescale: 30,
            defaultSampleDuration: 0,
            editMediaTime: 0,
        }

        it('sums per-sample durations from the tfdt', () => {
            const data = segment(
                moof({ decodeTime: 135, durations: [1, 1, 1] })
            )
            expect(getFragmentTimeRange(data, timing)).toEqual({
                start: 4.5,
                end: 4.6,
            })
        })

        it('spans multiple fragments', () => {
            const data = segment(
                moof({ decodeTime: 30, durations: [15, 15] }),
                moof({ decodeTime: 60, durations: [30] })
            )
            expect(getFragmentTimeRange(data, timing)).toEqual({
                start: 1,
                end: 3,
            })
        })

        it('uses the tfhd default sample duration', () => {
            const data = segment(
                moof({ decodeTime: 0, sampleCount: 90, tfhdDuration: 1 })
            )
            expect(getFragmentTimeRange(data, timing)).toEqual({
                start: 0,
                end: 3,
            })
        })

        it('falls back to the trex default sample duration', () => {
            const data = segment(moof({ decodeTime: 0, sampleCount: 60 }))
            expect(
                getFragmentTimeRange(data, {
                    timescale: 30,
                    defaultSampleDuration: 2,
                    editMediaTime: 0,
                })
            ).toEqual({ start: 0, end: 4 })
        })

        it('reads a 64-bit tfdt', () => {
            const decodeTime = 2 ** 33 * 30
            const data = segment(
                moof({ decodeTime, durations: [30], tfdtVersion: 1 })
            )
            expect(getFragmentTimeRange(data, timing)).toEqual({
                start: 2 ** 33,
                end: 2 ** 33 + 1,
            })
        })

        it('returns null without fragments', () => {
            expect(getFragmentTimeRange(segment(), timing)).toBeNull()
            expect(
                getFragmentTimeRange(
                    new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]).buffer,
                    timing
                )
            ).toBeNull()
        })

        it('returns null for a fragment without a tfdt', () => {
            const traf = box('traf', fullBox('trun', 0, 0, uint32(1)))
            const data = concat(box('moof', traf)).buffer
            expect(getFragmentTimeRange(data, timing)).toBeNull()
        })

        it('returns null when a box claims more samples than it holds', () => {
            // A well-formed trun box whose sample count overruns its payload.
            const trun = fullBox('trun', 0, 0x100, uint32(1000, 1))
            const traf = box('traf', fullBox('tfdt', 0, 0, uint32(0)), trun)
            expect(
                getFragmentTimeRange(box('moof', traf).buffer, timing)
            ).toBeNull()
        })

        it('skips a moof without a traf', () => {
            const data = segment(
                box('moof', fullBox('mfhd', 0, 0, uint32(1))),
                moof({ decodeTime: 30, durations: [30] })
            )
            expect(getFragmentTimeRange(data, timing)).toEqual({
                start: 1,
                end: 2,
            })
        })

        it('skips the optional tfhd and trun fields', () => {
            // tfhd: base_data_offset, sample_description_index, default duration.
            const tfhd = fullBox('tfhd', 0, 0x0b, uint32(1, 0, 0, 1, 2))
            // trun: data_offset, first_sample_flags, then per sample duration,
            // size, flags, and composition time offset.
            const trun = fullBox(
                'trun',
                0,
                0xf05,
                uint32(2, 0, 0, 3, 100, 0, 0, 3, 100, 0, 0)
            )
            const traf = box(
                'traf',
                tfhd,
                fullBox('tfdt', 0, 0, uint32(30)),
                trun
            )
            expect(
                getFragmentTimeRange(box('moof', traf).buffer, timing)
            ).toEqual({ start: 1, end: 1.2 })
        })

        it('returns the presentation range of reordered samples', () => {
            // B-frames without an edit list (e.g. Apple's HLS interstitial
            // sample): decode order I P B B, each 1 unit, with composition
            // offsets delaying the first presented sample by 1 unit.
            const trun = fullBox(
                'trun',
                0,
                0x900,
                uint32(4, 1, 1, 1, 3, 1, 0, 1, 0)
            )
            const traf = box(
                'traf',
                fullBox('tfhd', 0, 0, uint32(1)),
                fullBox('tfdt', 0, 0, uint32(30)),
                trun
            )
            const range = getFragmentTimeRange(box('moof', traf).buffer, timing)
            expect(range!.start).toBeCloseTo(31 / 30, 10)
            expect(range!.end).toBeCloseTo(35 / 30, 10)
        })

        it('subtracts the edit list media time', () => {
            // The B-frame delay shifted out by an edit list (e.g. libx264 via
            // shaka-packager): the first sample presents at 0.
            const trun = fullBox(
                'trun',
                0,
                0x900,
                uint32(4, 1, 2, 1, 4, 1, 1, 1, 1)
            )
            const traf = box(
                'traf',
                fullBox('tfhd', 0, 0, uint32(1)),
                fullBox('tfdt', 0, 0, uint32(0)),
                trun
            )
            const range = getFragmentTimeRange(box('moof', traf).buffer, {
                ...timing,
                editMediaTime: 2,
            })
            expect(range!.start).toBeCloseTo(0, 10)
            expect(range!.end).toBeCloseTo(4 / 30, 10)
        })

        it('applies the edit list of a parsed init segment', () => {
            const elst = fullBox('elst', 0, 0, uint32(1, 0, 60, 0x10000))
            const timing = getMp4InitTiming(init(30, 30, elst))!
            const range = getFragmentTimeRange(
                segment(moof({ decodeTime: 120, sampleCount: 2 })),
                timing
            )
            expect(range).toEqual({ start: 2, end: 4 })
        })

        it('reads signed version 1 composition offsets', () => {
            // Offsets normalized so the first presented sample is at its
            // decode time; the last sample is presented 1 unit early.
            const trun = fullBox(
                'trun',
                1,
                0x900,
                uint32(3, 1, 0, 1, 1, 1, -1 >>> 0)
            )
            const traf = box(
                'traf',
                fullBox('tfhd', 0, 0, uint32(1)),
                fullBox('tfdt', 0, 0, uint32(30)),
                trun
            )
            const range = getFragmentTimeRange(box('moof', traf).buffer, timing)
            expect(range!.start).toBe(1)
            expect(range!.end).toBeCloseTo(1.1, 10)
        })

        it('applies composition offsets with default durations', () => {
            // Composition offsets only; durations from the tfhd.
            const trun = fullBox('trun', 0, 0x800, uint32(2, 6, 0))
            const traf = box(
                'traf',
                fullBox('tfhd', 0, 0x08, uint32(1, 3)),
                fullBox('tfdt', 0, 0, uint32(0)),
                trun
            )
            const range = getFragmentTimeRange(box('moof', traf).buffer, timing)
            expect(range!.start).toBeCloseTo(0.1, 10)
            expect(range!.end).toBeCloseTo(0.3, 10)
        })

        it('returns an empty range at the decode time without samples', () => {
            const traf = box(
                'traf',
                fullBox('tfhd', 0, 0, uint32(1)),
                fullBox('tfdt', 0, 0, uint32(30)),
                fullBox('trun', 0, 0x100, uint32(0))
            )
            expect(
                getFragmentTimeRange(box('moof', traf).buffer, timing)
            ).toEqual({ start: 1, end: 1 })
        })

        it('continues decode times across truns', () => {
            const traf = box(
                'traf',
                fullBox('tfhd', 0, 0, uint32(1)),
                fullBox('tfdt', 0, 0, uint32(30)),
                fullBox('trun', 0, 0x100, uint32(1, 15)),
                fullBox('trun', 0, 0x100, uint32(1, 15))
            )
            expect(
                getFragmentTimeRange(box('moof', traf).buffer, timing)
            ).toEqual({ start: 1, end: 2 })
        })

        it('reads 64-bit and to-end box sizes', () => {
            const inner = new Uint8Array(
                moof({ decodeTime: 30, durations: [30] })
            )
            // Rewrite the moof header with size 1 and a 64-bit largesize.
            const large = concat(
                uint32(1),
                inner.subarray(4, 8),
                uint32(0, inner.length + 8),
                inner.subarray(8)
            )
            expect(getFragmentTimeRange(large.buffer, timing)).toEqual({
                start: 1,
                end: 2,
            })
            // Size 0: the box runs to the end of the data.
            const toEnd = concat(uint32(0), inner.subarray(4))
            expect(getFragmentTimeRange(toEnd.buffer, timing)).toEqual({
                start: 1,
                end: 2,
            })
        })

        it('stops at a box with an invalid size', () => {
            const data = concat(uint32(4), fourCC('moof'))
            expect(getFragmentTimeRange(data.buffer, timing)).toBeNull()
        })
    })

    it('getMp4InitTiming returns null for a truncated mdhd', () => {
        const moov = box(
            'moov',
            box('trak', box('mdia', box('mdhd', uint32(0))))
        )
        expect(getMp4InitTiming(moov.buffer)).toBeNull()
    })

    it('getMp4InitTiming returns null without an mdhd', () => {
        const moov = box('moov', box('trak', box('mdia')))
        expect(getMp4InitTiming(moov.buffer)).toBeNull()
    })

    it('getMp4InitTiming reads a version 1 mdhd', () => {
        // 64-bit creation and modification times precede the timescale.
        const mdhd = fullBox('mdhd', 1, 0, uint32(0, 0, 0, 0, 90000, 0, 0))
        const moov = box('moov', box('trak', box('mdia', mdhd)))
        expect(getMp4InitTiming(moov.buffer)).toEqual({
            timescale: 90000,
            defaultSampleDuration: 0,
            editMediaTime: 0,
        })
    })

    it('getMp4InitTiming returns null for a zero timescale', () => {
        expect(getMp4InitTiming(init(0))).toBeNull()
    })
    describe('shaka-packager segments', () => {
        function decode(base64: string): ArrayBuffer {
            return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer
        }

        // Ranges as reported by ffprobe for the init and media segments.
        it('matches the presentation times of libx264 video', () => {
            const timing = getMp4InitTiming(decode(shaka.videoInit))!
            const first = getFragmentTimeRange(decode(shaka.videoMoof1), timing)
            const second = getFragmentTimeRange(
                decode(shaka.videoMoof2),
                timing
            )
            expect(first!.start).toBeCloseTo(0, 5)
            expect(first!.end).toBeCloseTo(2, 5)
            expect(second!.start).toBeCloseTo(2, 5)
            expect(second!.end).toBeCloseTo(4, 5)
        })

        it('matches the presentation times of AAC with priming', () => {
            const timing = getMp4InitTiming(decode(shaka.audioInit))!
            const first = getFragmentTimeRange(decode(shaka.audioMoof1), timing)
            const second = getFragmentTimeRange(
                decode(shaka.audioMoof2),
                timing
            )
            expect(first!.start).toBeCloseTo(-0.02322, 5)
            expect(first!.end).toBeCloseTo(2.020136, 5)
            expect(second!.start).toBeCloseTo(2.020136, 5)
            expect(second!.end).toBeCloseTo(4.017052, 5)
        })
    })
})
