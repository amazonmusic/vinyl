/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    base64ToByteArray,
    BitReader,
    BufferError,
    ErrorOrigin,
    ReportableError,
} from '@amazon/vinyl-util'
import type {
    BreakDuration,
    SegmentationDescriptor,
    SpliceCommand,
    SpliceDescriptor,
    SpliceInfoSection,
} from './SpliceInfoSection'

/** The `table_id` of a `splice_info_section`. */
const SPLICE_INFO_TABLE_ID = 0xfc

/** The `splice_descriptor_tag` of a `segmentation_descriptor`. */
const SEGMENTATION_DESCRIPTOR_TAG = 0x02

/**
 * Decodes a binary SCTE-35 `splice_info_section`.
 *
 * The CRC is not verified: packagers commonly rewrite sections, and a stale
 * CRC does not make the cue less useful to a player.
 *
 * @throws Scte35Error if the data is not a well-formed section.
 */
export function decodeSpliceInfoSection(
    data: ArrayLike<number> | ArrayBuffer
): SpliceInfoSection {
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data
    try {
        return readSpliceInfoSection(new BitReader(bytes), bytes.length)
    } catch (error) {
        if (error instanceof BufferError)
            throw new Scte35Error('splice_info_section is truncated')
        throw error
    }
}

function readSpliceInfoSection(
    reader: BitReader,
    byteLength: number
): SpliceInfoSection {
    if (reader.readBits(8) !== SPLICE_INFO_TABLE_ID)
        throw new Scte35Error('not a splice_info_section')
    reader.skip(4) // section_syntax_indicator, private_indicator, sap_type
    const sectionLength = reader.readBits(12)
    if (sectionLength + 3 > byteLength)
        throw new Scte35Error('splice_info_section is truncated')
    reader.skip(8) // protocol_version
    const encrypted = reader.readFlag()
    reader.skip(6) // encryption_algorithm
    const ptsAdjustment = reader.readBits(33)
    reader.skip(8) // cw_index
    const tier = reader.readBits(12)
    const commandLength = reader.readBits(12)
    const commandType = reader.readBits(8)
    const commandStart = reader.bytePosition
    let command: SpliceCommand
    if (encrypted) {
        command = { type: 'unknown', commandType }
    } else {
        command = readCommand(reader, commandType)
    }
    // A splice_command_length of 0xFFF means "unspecified" (legacy).
    if (commandLength !== 0xfff) reader.seek(commandStart + commandLength)
    const descriptors: SpliceDescriptor[] = []
    if (!encrypted) {
        const loopLength = reader.readBits(16)
        const loopEnd = reader.bytePosition + loopLength
        while (reader.bytePosition + 6 <= loopEnd) {
            descriptors.push(readDescriptor(reader))
        }
    }
    return { ptsAdjustment, tier, encrypted, command, descriptors }
}

/**
 * Decodes a section given as text, as carried by the HLS `SCTE35-OUT`,
 * `SCTE35-IN`, and `SCTE35-CMD` date range attributes (hexadecimal, `0x`
 * prefixed) or by SCTE 214 MPD events (base64).
 *
 * @throws Scte35Error if the text is not a well-formed section.
 */
export function decodeSpliceInfoSectionText(text: string): SpliceInfoSection {
    const trimmed = text.trim()
    if (/^0x/i.test(trimmed)) {
        return decodeSpliceInfoSection(hexToBytes(trimmed.slice(2)))
    }
    let bytes: Uint8Array
    try {
        bytes = base64ToByteArray(trimmed)
    } catch {
        throw new Scte35Error('splice_info_section is not hex or base64')
    }
    return decodeSpliceInfoSection(bytes)
}

function hexToBytes(hex: string): Uint8Array {
    if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex))
        throw new Scte35Error('splice_info_section is not valid hex')
    const out = new Uint8Array(hex.length / 2)
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
    }
    return out
}

function readCommand(reader: BitReader, commandType: number): SpliceCommand {
    switch (commandType) {
        case 0x00:
            return { type: 'spliceNull' }
        case 0x05:
            return readSpliceInsert(reader)
        case 0x06:
            return { type: 'timeSignal', spliceTime: readSpliceTime(reader) }
        default:
            return { type: 'unknown', commandType }
    }
}

function readSpliceInsert(reader: BitReader): SpliceCommand {
    const spliceEventId = reader.readBits(32)
    const cancel = reader.readFlag()
    reader.skip(7)
    if (cancel) {
        return {
            type: 'spliceInsert',
            spliceEventId,
            cancel,
            outOfNetwork: false,
            spliceImmediate: false,
            spliceTime: null,
            breakDuration: null,
            uniqueProgramId: 0,
            availNum: 0,
            availsExpected: 0,
        }
    }
    const outOfNetwork = reader.readFlag()
    const programSplice = reader.readFlag()
    const hasDuration = reader.readFlag()
    const spliceImmediate = reader.readFlag()
    reader.skip(4)
    let spliceTime: number | null = null
    if (programSplice) {
        if (!spliceImmediate) spliceTime = readSpliceTime(reader)
    } else {
        const componentCount = reader.readBits(8)
        for (let i = 0; i < componentCount; i++) {
            reader.skip(8) // component_tag
            if (!spliceImmediate) {
                const time = readSpliceTime(reader)
                if (i === 0) spliceTime = time
            }
        }
    }
    const breakDuration = hasDuration ? readBreakDuration(reader) : null
    return {
        type: 'spliceInsert',
        spliceEventId,
        cancel,
        outOfNetwork,
        spliceImmediate,
        spliceTime,
        breakDuration,
        uniqueProgramId: reader.readBits(16),
        availNum: reader.readBits(8),
        availsExpected: reader.readBits(8),
    }
}

/**
 * Reads `splice_time()`, returning the pts time or null when unspecified.
 */
function readSpliceTime(reader: BitReader): number | null {
    if (reader.readFlag()) {
        reader.skip(6)
        return reader.readBits(33)
    }
    reader.skip(7)
    return null
}

function readBreakDuration(reader: BitReader): BreakDuration {
    const autoReturn = reader.readFlag()
    reader.skip(6)
    return { autoReturn, duration: reader.readBits(33) }
}

function readDescriptor(reader: BitReader): SpliceDescriptor {
    const tag = reader.readBits(8)
    const length = reader.readBits(8)
    const end = reader.bytePosition + length
    const identifier = reader.readBits(32)
    const descriptor: SpliceDescriptor =
        tag === SEGMENTATION_DESCRIPTOR_TAG
            ? readSegmentationDescriptor(reader)
            : { type: 'unknown', tag, identifier }
    reader.seek(end)
    return descriptor
}

function readSegmentationDescriptor(reader: BitReader): SegmentationDescriptor {
    const segmentationEventId = reader.readBits(32)
    const cancel = reader.readFlag()
    reader.skip(7)
    if (cancel) {
        return {
            type: 'segmentation',
            segmentationEventId,
            cancel,
            segmentationDuration: null,
            upidType: 0,
            upid: new Uint8Array(0),
            segmentationTypeId: 0,
            segmentNum: 0,
            segmentsExpected: 0,
        }
    }
    const programSegmentation = reader.readFlag()
    const hasDuration = reader.readFlag()
    // delivery_not_restricted_flag and either the restriction flags or
    // reserved bits.
    reader.skip(6)
    if (!programSegmentation) {
        const componentCount = reader.readBits(8)
        // component_tag, reserved, pts_offset
        reader.skip(componentCount * 48)
    }
    const segmentationDuration = hasDuration ? reader.readBits(40) : null
    const upidType = reader.readBits(8)
    const upidLength = reader.readBits(8)
    const upid = reader.readBytes(upidLength)
    return {
        type: 'segmentation',
        segmentationEventId,
        cancel,
        segmentationDuration,
        upidType,
        upid,
        segmentationTypeId: reader.readBits(8),
        segmentNum: reader.readBits(8),
        segmentsExpected: reader.readBits(8),
    }
}

/**
 * An SCTE-35 cue message could not be decoded.
 */
export class Scte35Error extends ReportableError {
    get [Symbol.toStringTag](): string {
        return 'Scte35Error'
    }

    constructor(message: string) {
        super(message, ErrorOrigin.MEDIA)
        Object.setPrototypeOf(this, Scte35Error.prototype)
    }
}
