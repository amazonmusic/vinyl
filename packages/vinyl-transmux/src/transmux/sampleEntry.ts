/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Codec-specific MP4 sample entry builders for AAC and H.264.
 *
 * These produce the sample entry boxes (mp4a, avc1) that are placed inside
 * the generic stsd box built by the mp4 layer.
 *
 * @module
 */

import { BufferWriter } from '@amazon/vinyl-util'
import { box, fullBox } from '../mp4/mp4'

/** 72 dpi in 16.16 fixed point. */
const RESOLUTION_72_DPI = 0x00480000

/** ESDS object type indication for AAC (ISO 14496-3). */
const OBJECT_TYPE_AAC = 0x40

/** ESDS stream type for audio: (0x05 << 2) | 0x01. */
const STREAM_TYPE_AUDIO = 0x15

export interface AudioTrackConfig {
    readonly audioObjectType: number
    readonly samplingFrequencyIndex: number
    readonly channelConfiguration: number
    readonly sampleRate: number
    readonly audioSpecificConfig: Uint8Array
}

export interface VideoTrackConfig {
    readonly width: number
    readonly height: number
    readonly sps: Uint8Array
    readonly pps: Uint8Array
    readonly profileIdc: number
    readonly profileCompatibility: number
    readonly levelIdc: number
}

/**
 * Builds an mp4a sample entry box for AAC audio.
 */
export function mp4aSampleEntry(config: AudioTrackConfig): Uint8Array {
    const writer = new BufferWriter(28)
    // 6 bytes reserved
    for (let i = 0; i < 6; i++) writer.writeUint8(0)
    writer.writeUint16(1) // data_reference_index
    // 8 bytes reserved
    for (let i = 0; i < 8; i++) writer.writeUint8(0)
    writer.writeUint16(config.channelConfiguration)
    writer.writeUint16(16) // sample_size
    writer.writeUint16(0) // pre_defined
    writer.writeUint16(0) // reserved
    writer.writeUint32(config.sampleRate << 16) // sample_rate (16.16)
    return box('mp4a', writer.toUint8Array(), esds(config))
}

/**
 * Builds an avc1 sample entry box for H.264 video.
 */
export function avc1SampleEntry(config: VideoTrackConfig): Uint8Array {
    const writer = new BufferWriter(78)
    // 6 bytes reserved
    for (let i = 0; i < 6; i++) writer.writeUint8(0)
    writer.writeUint16(1) // data_reference_index
    // 16 bytes pre_defined + reserved
    for (let i = 0; i < 16; i++) writer.writeUint8(0)
    writer.writeUint16(config.width)
    writer.writeUint16(config.height)
    writer.writeUint32(RESOLUTION_72_DPI)
    writer.writeUint32(RESOLUTION_72_DPI)
    writer.writeUint32(0) // reserved
    writer.writeUint16(1) // frame_count
    // 32 bytes compressorname
    for (let i = 0; i < 32; i++) writer.writeUint8(0)
    writer.writeUint16(0x0018) // depth = 24
    writer.writeInt16(-1) // pre_defined
    return box('avc1', writer.toUint8Array(), avcC(config))
}

function esds(config: AudioTrackConfig): Uint8Array {
    const asc = config.audioSpecificConfig

    // DecoderSpecificInfo (tag 0x05)
    const dsi = new BufferWriter(2 + asc.byteLength)
    dsi.writeUint8(0x05)
    dsi.writeUint8(asc.byteLength)
    dsi.writeBytes(asc)

    // DecoderConfigDescriptor (tag 0x04)
    const dcd = new BufferWriter(2 + 13 + dsi.position)
    dcd.writeUint8(0x04)
    dcd.writeUint8(13 + dsi.position)
    dcd.writeUint8(OBJECT_TYPE_AAC)
    dcd.writeUint8(STREAM_TYPE_AUDIO)
    dcd.writeUint8(0) // bufferSizeDB (3 bytes)
    dcd.writeUint8(0)
    dcd.writeUint8(0)
    dcd.writeUint32(0) // maxBitrate
    dcd.writeUint32(0) // avgBitrate
    dcd.writeBytes(dsi.toUint8Array())

    // SLConfigDescriptor (tag 0x06)
    const slc = new BufferWriter(3)
    slc.writeUint8(0x06)
    slc.writeUint8(1)
    slc.writeUint8(0x02) // predefined = 2

    // ES_Descriptor (tag 0x03)
    const esPayloadSize = 3 + dcd.position + slc.position
    const es = new BufferWriter(2 + esPayloadSize)
    es.writeUint8(0x03)
    es.writeUint8(esPayloadSize)
    es.writeUint16(1) // ES_ID
    es.writeUint8(0) // flags
    es.writeBytes(dcd.toUint8Array())
    es.writeBytes(slc.toUint8Array())

    return fullBox('esds', 0, 0, es.toUint8Array())
}

function avcC(config: VideoTrackConfig): Uint8Array {
    const writer = new BufferWriter(
        11 + config.sps.byteLength + config.pps.byteLength
    )
    writer.writeUint8(1) // configurationVersion
    writer.writeUint8(config.profileIdc)
    writer.writeUint8(config.profileCompatibility)
    writer.writeUint8(config.levelIdc)
    writer.writeUint8(3) // lengthSizeMinusOne = 3 (4 bytes)
    writer.writeUint8(0xe1) // numOfSequenceParameterSets = 1
    writer.writeUint16(config.sps.byteLength)
    writer.writeBytes(config.sps)
    writer.writeUint8(1) // numOfPictureParameterSets
    writer.writeUint16(config.pps.byteLength)
    writer.writeBytes(config.pps)
    return box('avcC', writer.toUint8Array())
}
