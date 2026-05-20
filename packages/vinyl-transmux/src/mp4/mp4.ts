/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ISO BMFF (MP4) box writing utilities.
 *
 * Provides functions to construct the fMP4 boxes required by MSE:
 * - `ftyp`: file type
 * - `moov` / `mvhd` / `trak` / `mdia` / `minf` / `stbl`: track metadata
 * - `moof` / `mdat`: media fragments
 *
 * @module
 */

import { BufferWriter } from '@amazon/vinyl-util'

/** ISO 14496-12 identity matrix in 16.16 / 2.30 fixed point. */
const UNITY_MATRIX = [
    0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000,
] as const

/** 90 kHz timescale from ISO 13818-1 (MPEG system clock). */
export const MPEG_TIMESCALE = 90000

/** ISO 639-2/T packed language code for 'und' (undetermined). */
const LANGUAGE_UNDETERMINED = 0x55c4

/**
 * Writes a generic MP4 box (atom). The size field is automatically computed.
 */
export function box(type: string, ...payloads: Uint8Array[]): Uint8Array {
    let size = 8
    for (const p of payloads) size += p.byteLength
    const writer = new BufferWriter(size)
    writer.writeUint32(size)
    writer.writeString(type)
    for (const p of payloads) writer.writeBytes(p)
    return writer.toUint8Array()
}

/**
 * Writes a full box with version and flags.
 */
export function fullBox(
    type: string,
    version: number,
    flags: number,
    payload: Uint8Array
): Uint8Array {
    const size = 12 + payload.byteLength
    const writer = new BufferWriter(size)
    writer.writeUint32(size)
    writer.writeString(type)
    writer.writeUint8(version)
    // 24-bit flags
    writer.writeUint8((flags >> 16) & 0xff)
    writer.writeUint8((flags >> 8) & 0xff)
    writer.writeUint8(flags & 0xff)
    writer.writeBytes(payload)
    return writer.toUint8Array()
}

export interface FtypOptions {
    readonly majorBrand?: string
    readonly minorVersion?: number
    readonly compatibleBrands?: readonly string[]
}

const DEFAULT_FTYP: Required<FtypOptions> = {
    majorBrand: 'isom',
    minorVersion: 0x200,
    compatibleBrands: ['isom', 'iso6', 'mp41'],
}

/**
 * Generates the ftyp box.
 */
export function ftyp(options?: FtypOptions): Uint8Array {
    const { majorBrand, minorVersion, compatibleBrands } = {
        ...DEFAULT_FTYP,
        ...options,
    }
    const writer = new BufferWriter(8 + compatibleBrands.length * 4)
    writer.writeString(majorBrand)
    writer.writeUint32(minorVersion)
    for (const brand of compatibleBrands) writer.writeString(brand)
    return box('ftyp', writer.toUint8Array())
}

/**
 * Generates a moov box from pre-built track boxes.
 */
export function moov(...traks: Uint8Array[]): Uint8Array {
    const trakAndMvex: Uint8Array[] = []
    for (let i = 0; i < traks.length; i++) {
        trakAndMvex.push(traks[i], mvex(i + 1))
    }
    return box('moov', mvhd(), ...trakAndMvex)
}

export interface MvhdOptions {
    readonly timescale?: number
    readonly duration?: number
    readonly rate?: number
    readonly volume?: number
}

const DEFAULT_MVHD: Required<MvhdOptions> = {
    timescale: MPEG_TIMESCALE,
    duration: 0,
    rate: 1.0,
    volume: 1.0,
}

function mvhd(options?: MvhdOptions): Uint8Array {
    const { timescale, duration, rate, volume } = {
        ...DEFAULT_MVHD,
        ...options,
    }
    const writer = new BufferWriter(96)
    writer.writeUint32(0) // creation_time
    writer.writeUint32(0) // modification_time
    writer.writeUint32(timescale)
    writer.writeUint32(duration)
    writer.writeUint32(rate * 0x10000) // 16.16 fixed point
    writer.writeUint16(volume * 0x100) // 8.8 fixed point
    // 10 bytes reserved
    for (let i = 0; i < 10; i++) writer.writeUint8(0)
    for (const v of UNITY_MATRIX) writer.writeUint32(v)
    // 6 x uint32 pre_defined
    for (let i = 0; i < 6; i++) writer.writeUint32(0)
    writer.writeUint32(0xffffffff) // next_track_ID
    return fullBox('mvhd', 0, 0, writer.toUint8Array())
}

export interface AudioTrackOptions {
    readonly trackId: number
    readonly sampleRate: number
    readonly channelCount: number
    readonly sampleEntry: Uint8Array
}

export interface VideoTrackOptions {
    readonly trackId: number
    readonly width: number
    readonly height: number
    readonly timescale?: number
    readonly sampleEntry: Uint8Array
}

export function audioTrak(options: AudioTrackOptions): Uint8Array {
    return box(
        'trak',
        tkhd(options.trackId, 0, 0, options.channelCount > 0 ? 1.0 : 0),
        box(
            'mdia',
            mdhd(options.sampleRate),
            hdlr('soun', 'SoundHandler'),
            box('minf', smhd(), dinf(), audioStbl(options.sampleEntry))
        )
    )
}

export function videoTrak(options: VideoTrackOptions): Uint8Array {
    return box(
        'trak',
        tkhd(options.trackId, options.width, options.height, 0),
        box(
            'mdia',
            mdhd(options.timescale ?? MPEG_TIMESCALE),
            hdlr('vide', 'VideoHandler'),
            box('minf', vmhd(), dinf(), videoStbl(options.sampleEntry))
        )
    )
}

function tkhd(
    trackId: number,
    width: number,
    height: number,
    volume: number
): Uint8Array {
    const writer = new BufferWriter(80)
    writer.writeUint32(0) // creation_time
    writer.writeUint32(0) // modification_time
    writer.writeUint32(trackId)
    writer.writeUint32(0) // reserved
    writer.writeUint32(0) // duration
    writer.writeUint32(0) // reserved
    writer.writeUint32(0) // reserved
    writer.writeUint16(0) // layer
    writer.writeUint16(0) // alternate_group
    writer.writeUint16(volume * 0x100) // volume (8.8 fixed point)
    writer.writeUint16(0) // reserved
    // unity matrix
    for (const v of UNITY_MATRIX) writer.writeUint32(v)

    writer.writeUint32(width * 0x10000) // width (16.16 fixed point)
    writer.writeUint32(height * 0x10000) // height (16.16 fixed point)
    return fullBox('tkhd', 0, 0x000003, writer.toUint8Array())
}

function mdhd(timescale: number): Uint8Array {
    const writer = new BufferWriter(20)
    writer.writeUint32(0) // creation_time
    writer.writeUint32(0) // modification_time
    writer.writeUint32(timescale)
    writer.writeUint32(0) // duration
    writer.writeUint16(LANGUAGE_UNDETERMINED)
    writer.writeUint16(0) // pre_defined
    return fullBox('mdhd', 0, 0, writer.toUint8Array())
}

function hdlr(handlerType: string, name: string): Uint8Array {
    const writer = new BufferWriter(21 + name.length)
    writer.writeUint32(0) // pre_defined
    writer.writeString(handlerType)
    writer.writeUint32(0) // reserved
    writer.writeUint32(0) // reserved
    writer.writeUint32(0) // reserved
    writer.writeString(name)
    writer.writeUint8(0) // null terminator
    return fullBox('hdlr', 0, 0, writer.toUint8Array())
}

function smhd(): Uint8Array {
    const writer = new BufferWriter(4)
    writer.writeUint16(0) // balance
    writer.writeUint16(0) // reserved
    return fullBox('smhd', 0, 0, writer.toUint8Array())
}

function vmhd(): Uint8Array {
    const writer = new BufferWriter(8)
    writer.writeUint16(0) // graphicsmode
    writer.writeUint16(0) // opcolor
    writer.writeUint16(0)
    writer.writeUint16(0)
    return fullBox('vmhd', 0, 0x000001, writer.toUint8Array())
}

function dinf(): Uint8Array {
    const writer = new BufferWriter(4)
    writer.writeUint32(1) // entry_count
    const urlBox = fullBox('url ', 0, 0x000001, new Uint8Array(0))
    return box(
        'dinf',
        fullBox('dref', 0, 0, concatUint8(writer.toUint8Array(), urlBox))
    )
}

function audioStbl(sampleEntry: Uint8Array): Uint8Array {
    return box('stbl', stsd(sampleEntry), stts(), stsc(), stsz(), stco())
}

function videoStbl(sampleEntry: Uint8Array): Uint8Array {
    return box('stbl', stsd(sampleEntry), stts(), stsc(), stsz(), stco())
}

function stsd(sampleEntry: Uint8Array): Uint8Array {
    const writer = new BufferWriter(4)
    writer.writeUint32(1) // entry_count
    return fullBox(
        'stsd',
        0,
        0,
        concatUint8(writer.toUint8Array(), sampleEntry)
    )
}

function stts(): Uint8Array {
    const writer = new BufferWriter(4)
    writer.writeUint32(0) // entry_count
    return fullBox('stts', 0, 0, writer.toUint8Array())
}

function stsc(): Uint8Array {
    const writer = new BufferWriter(4)
    writer.writeUint32(0) // entry_count
    return fullBox('stsc', 0, 0, writer.toUint8Array())
}

function stsz(): Uint8Array {
    const writer = new BufferWriter(8)
    writer.writeUint32(0) // sample_size
    writer.writeUint32(0) // sample_count
    return fullBox('stsz', 0, 0, writer.toUint8Array())
}

function stco(): Uint8Array {
    const writer = new BufferWriter(4)
    writer.writeUint32(0) // entry_count
    return fullBox('stco', 0, 0, writer.toUint8Array())
}

function mvex(trackId: number): Uint8Array {
    return box('mvex', trex(trackId))
}

function trex(trackId: number): Uint8Array {
    const writer = new BufferWriter(20)
    writer.writeUint32(trackId)
    writer.writeUint32(1) // default_sample_description_index
    writer.writeUint32(0) // default_sample_duration
    writer.writeUint32(0) // default_sample_size
    writer.writeUint32(0) // default_sample_flags
    return fullBox('trex', 0, 0, writer.toUint8Array())
}

export interface MoofOptions {
    readonly sequenceNumber: number
    readonly trackId: number
    readonly baseDecodeTime: number
    readonly samples: readonly SampleEntry[]
}

export interface SampleEntry {
    readonly duration: number
    readonly size: number
    readonly flags?: number
    readonly compositionTimeOffset?: number
}

/**
 * Generates a moof (movie fragment) box.
 */
export function moof(options: MoofOptions): Uint8Array {
    return box('moof', mfhd(options.sequenceNumber), traf(options))
}

function mfhd(sequenceNumber: number): Uint8Array {
    const writer = new BufferWriter(4)
    writer.writeUint32(sequenceNumber)
    return fullBox('mfhd', 0, 0, writer.toUint8Array())
}

function traf(options: MoofOptions): Uint8Array {
    return box(
        'traf',
        tfhd(options.trackId),
        tfdt(options.baseDecodeTime),
        trun(options.samples)
    )
}

function tfhd(trackId: number): Uint8Array {
    const writer = new BufferWriter(4)
    writer.writeUint32(trackId)
    // flags: default-base-is-moof (0x020000)
    return fullBox('tfhd', 0, 0x020000, writer.toUint8Array())
}

function tfdt(baseDecodeTime: number): Uint8Array {
    const writer = new BufferWriter(4)
    writer.writeUint32(baseDecodeTime)
    return fullBox('tfdt', 0, 0, writer.toUint8Array())
}

function trun(samples: readonly SampleEntry[]): Uint8Array {
    // flags: data-offset-present (0x01), sample-duration-present (0x100),
    // sample-size-present (0x200), sample-flags-present (0x400)
    const hasFlags = samples.some((s) => s.flags != null)
    const hasCto = samples.some((s) => s.compositionTimeOffset != null)
    let flags = 0x000001 | 0x000100 | 0x000200
    if (hasFlags) flags |= 0x000400
    if (hasCto) flags |= 0x000800

    let entrySize = 8 // duration + size
    if (hasFlags) entrySize += 4
    if (hasCto) entrySize += 4

    const writer = new BufferWriter(8 + samples.length * entrySize)
    writer.writeUint32(samples.length) // sample_count
    writer.writeUint32(0) // data_offset (placeholder, patched later)

    for (const sample of samples) {
        writer.writeUint32(sample.duration)
        writer.writeUint32(sample.size)
        if (hasFlags) writer.writeUint32(sample.flags ?? 0)
        if (hasCto) writer.writeInt32(sample.compositionTimeOffset ?? 0)
    }

    const result = fullBox('trun', hasCto ? 1 : 0, flags, writer.toUint8Array())
    return result
}

/**
 * Generates an mdat box wrapping raw media data.
 */
export function mdat(data: Uint8Array): Uint8Array {
    return box('mdat', data)
}

/**
 * Patches the trun data_offset field. The data_offset is the byte offset from
 * the start of the moof to the first byte of the mdat payload.
 */
export function patchDataOffset(moofData: Uint8Array, moofSize: number): void {
    // data_offset = moofSize + 8 (mdat header)
    const dataOffset = moofSize + 8
    // Find trun box and patch the data_offset field.
    // trun is inside moof > traf. Walk the box tree.
    let pos = 8 // skip moof header
    while (pos < moofData.length) {
        const boxSize =
            ((moofData[pos] << 24) |
                (moofData[pos + 1] << 16) |
                (moofData[pos + 2] << 8) |
                moofData[pos + 3]) >>>
            0
        const boxType = String.fromCharCode(
            moofData[pos + 4],
            moofData[pos + 5],
            moofData[pos + 6],
            moofData[pos + 7]
        )
        if (boxType === 'traf') {
            // Recurse into traf
            let trafPos = pos + 8
            while (trafPos < pos + boxSize) {
                const innerSize =
                    ((moofData[trafPos] << 24) |
                        (moofData[trafPos + 1] << 16) |
                        (moofData[trafPos + 2] << 8) |
                        moofData[trafPos + 3]) >>>
                    0
                const innerType = String.fromCharCode(
                    moofData[trafPos + 4],
                    moofData[trafPos + 5],
                    moofData[trafPos + 6],
                    moofData[trafPos + 7]
                )
                if (innerType === 'trun') {
                    // data_offset is at offset 12+4 = 16 from box start
                    // (8 box header + 4 version/flags + 4 sample_count)
                    const offsetPos = trafPos + 16
                    moofData[offsetPos] = (dataOffset >> 24) & 0xff
                    moofData[offsetPos + 1] = (dataOffset >> 16) & 0xff
                    moofData[offsetPos + 2] = (dataOffset >> 8) & 0xff
                    moofData[offsetPos + 3] = dataOffset & 0xff
                    return
                }
                trafPos += innerSize
            }
        }
        pos += boxSize
    }
}

function concatUint8(...arrays: Uint8Array[]): Uint8Array {
    let total = 0
    for (const a of arrays) total += a.byteLength
    const result = new Uint8Array(total)
    let offset = 0
    for (const a of arrays) {
        result.set(a, offset)
        offset += a.byteLength
    }
    return result
}
