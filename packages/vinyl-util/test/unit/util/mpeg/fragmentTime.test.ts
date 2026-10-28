/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { getFragmentTimeRange, getMp4InitTiming } from '@amazon/vinyl-util'

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

function init(timescale: number, trexDuration?: number): ArrayBuffer {
    const mdhd = fullBox('mdhd', 0, 0, uint32(0, 0, timescale, 0, 0))
    const trak = box('trak', box('mdia', mdhd))
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
            })
        })

        it('defaults the sample duration to 0 without a trex', () => {
            expect(getMp4InitTiming(init(48000))).toEqual({
                timescale: 48000,
                defaultSampleDuration: 0,
            })
        })

        it('returns null for data that is not an mp4 init segment', () => {
            expect(getMp4InitTiming(new Uint8Array(64).buffer)).toBeNull()
            expect(getMp4InitTiming(new ArrayBuffer(0))).toBeNull()
        })
    })

    describe('getFragmentTimeRange', () => {
        const timing = { timescale: 30, defaultSampleDuration: 0 }

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
        })
    })

    it('getMp4InitTiming returns null for a zero timescale', () => {
        expect(getMp4InitTiming(init(0))).toBeNull()
    })
})
