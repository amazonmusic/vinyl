/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * MPEG-TS constants and packet-level parsing.
 *
 * An MPEG Transport Stream consists of fixed 188-byte packets. Each packet
 * starts with a sync byte (0x47) and carries a 13-bit PID identifying the
 * elementary stream. The PAT (PID 0) maps program numbers to PMT PIDs, and
 * the PMT lists the elementary stream PIDs with their stream types.
 *
 * @module
 */

export const TS_PACKET_SIZE = 188
export const TS_SYNC_BYTE = 0x47

/** Well-known stream type identifiers from ISO/IEC 13818-1. */
export const STREAM_TYPE_AAC = 0x0f
export const STREAM_TYPE_H264 = 0x1b
export const STREAM_TYPE_H265 = 0x24
export const STREAM_TYPE_ID3 = 0x15

export interface TsPacketHeader {
    readonly pid: number
    readonly payloadUnitStartIndicator: boolean
    readonly adaptationFieldControl: number
    readonly continuityCounter: number
}

export interface PmtEntry {
    readonly pid: number
    readonly streamType: number
}

/**
 * Parses a single 188-byte TS packet header.
 */
export function parseTsPacketHeader(
    data: Uint8Array,
    offset: number
): TsPacketHeader {
    const byte1 = data[offset + 1]
    const byte2 = data[offset + 2]
    const byte3 = data[offset + 3]
    return {
        pid: ((byte1 & 0x1f) << 8) | byte2,
        payloadUnitStartIndicator: (byte1 & 0x40) !== 0,
        adaptationFieldControl: (byte3 >> 4) & 0x03,
        continuityCounter: byte3 & 0x0f,
    }
}

/**
 * Returns the offset of the payload within a TS packet.
 */
export function getPayloadOffset(
    data: Uint8Array,
    offset: number,
    adaptationFieldControl: number
): number {
    let payloadOffset = offset + 4
    if (adaptationFieldControl >= 2) {
        // Adaptation field present
        payloadOffset += 1 + data[offset + 4]
    }
    return payloadOffset
}

/**
 * Parses the PAT (Program Association Table) to find the PMT PID.
 */
export function parsePat(data: Uint8Array, offset: number): number {
    // Skip pointer field
    const pointerField = data[offset]
    let pos = offset + 1 + pointerField
    // Skip table_id(1), section_syntax_indicator+length(2), transport_stream_id(2),
    // version/current(1), section_number(1), last_section_number(1)
    pos += 8
    // First program entry: program_number(2) + PMT_PID(2)
    // Skip program_number
    pos += 2
    return ((data[pos] & 0x1f) << 8) | data[pos + 1]
}

/**
 * Parses the PMT (Program Map Table) to extract elementary stream entries.
 */
export function parsePmt(data: Uint8Array, offset: number): PmtEntry[] {
    const pointerField = data[offset]
    let pos = offset + 1 + pointerField

    // table_id(1)
    pos += 1
    const sectionLength = ((data[pos] & 0x0f) << 8) | data[pos + 1]
    pos += 2
    const sectionEnd = pos + sectionLength
    // transport_stream_id(2), version/current(1), section_number(1), last_section_number(1)
    pos += 5
    // PCR_PID(2)
    pos += 2
    // program_info_length
    const programInfoLength = ((data[pos] & 0x0f) << 8) | data[pos + 1]
    pos += 2 + programInfoLength

    const entries: PmtEntry[] = []
    // -4 for CRC32
    while (pos < sectionEnd - 4) {
        const streamType = data[pos]
        pos += 1
        const pid = ((data[pos] & 0x1f) << 8) | data[pos + 1]
        pos += 2
        const esInfoLength = ((data[pos] & 0x0f) << 8) | data[pos + 1]
        pos += 2 + esInfoLength
        entries.push({ pid, streamType })
    }
    return entries
}

export interface DemuxedStream {
    readonly streamType: number
    readonly pid: number
    readonly data: Uint8Array[]
}

/**
 * Demuxes a complete MPEG-TS segment into elementary streams.
 * Reassembles PES packets from TS packets for each PID.
 */
export function demuxTsSegment(segment: Uint8Array): DemuxedStream[] {
    let pmtPid = -1
    const pmtEntries: PmtEntry[] = []
    const pesBuffers = new Map<number, Uint8Array[]>()

    // First pass: find PAT and PMT
    for (let i = 0; i + TS_PACKET_SIZE <= segment.length; i += TS_PACKET_SIZE) {
        if (segment[i] !== TS_SYNC_BYTE) continue
        const header = parseTsPacketHeader(segment, i)
        const payloadStart = getPayloadOffset(
            segment,
            i,
            header.adaptationFieldControl
        )
        if (
            header.adaptationFieldControl === 0 ||
            header.adaptationFieldControl === 2
        )
            continue

        if (header.pid === 0) {
            pmtPid = parsePat(segment, payloadStart)
        } else if (header.pid === pmtPid && pmtEntries.length === 0) {
            pmtEntries.push(...parsePmt(segment, payloadStart))
        }
    }

    // Initialize buffers for known elementary streams
    const pidToStreamType = new Map<number, number>()
    for (const entry of pmtEntries) {
        pidToStreamType.set(entry.pid, entry.streamType)
        pesBuffers.set(entry.pid, [])
    }

    // Second pass: collect PES data
    for (let i = 0; i + TS_PACKET_SIZE <= segment.length; i += TS_PACKET_SIZE) {
        if (segment[i] !== TS_SYNC_BYTE) continue
        const header = parseTsPacketHeader(segment, i)
        if (
            header.adaptationFieldControl === 0 ||
            header.adaptationFieldControl === 2
        )
            continue

        const buffers = pesBuffers.get(header.pid)
        if (!buffers) continue

        const payloadStart = getPayloadOffset(
            segment,
            i,
            header.adaptationFieldControl
        )
        const payloadEnd = i + TS_PACKET_SIZE
        if (payloadStart < payloadEnd) {
            buffers.push(segment.slice(payloadStart, payloadEnd))
        }
    }

    const streams: DemuxedStream[] = []
    for (const [pid, buffers] of pesBuffers) {
        if (buffers.length === 0) continue
        streams.push({
            pid,
            streamType: pidToStreamType.get(pid)!,
            data: buffers,
        })
    }
    return streams
}

/**
 * Concatenates an array of Uint8Arrays into a single Uint8Array.
 */
export function concatBuffers(buffers: Uint8Array[]): Uint8Array {
    let totalLength = 0
    for (const buf of buffers) totalLength += buf.byteLength
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const buf of buffers) {
        result.set(buf, offset)
        offset += buf.byteLength
    }
    return result
}

/**
 * Strips the PES header from raw PES packet data, returning the elementary
 * stream payload.
 */
export function stripPesHeader(pesData: Uint8Array): Uint8Array {
    // PES start code: 0x00 0x00 0x01
    if (pesData[0] !== 0 || pesData[1] !== 0 || pesData[2] !== 1) {
        // No PES header, return as-is (continuation data)
        return pesData
    }
    // PES header data length is at byte 8
    const pesHeaderDataLength = pesData[8]
    return pesData.subarray(9 + pesHeaderDataLength)
}

/**
 * Extracts the PTS (Presentation Time Stamp) from a PES header.
 * Returns the PTS in 90kHz clock ticks, or -1 if not present.
 */
export function parsePesPts(pesData: Uint8Array): number {
    if (pesData[0] !== 0 || pesData[1] !== 0 || pesData[2] !== 1) return -1
    const flags = pesData[7]
    if ((flags & 0x80) === 0) return -1
    // PTS is encoded in 5 bytes starting at byte 9
    const byte9 = pesData[9]
    const byte10 = pesData[10]
    const byte11 = pesData[11]
    const byte12 = pesData[12]
    const byte13 = pesData[13]
    return (
        (byte9 & 0x0e) * 0x20000000 + // (byte9 & 0x0E) << 29
        ((byte10 & 0xff) << 22) +
        ((byte11 & 0xfe) << 14) +
        ((byte12 & 0xff) << 7) +
        ((byte13 & 0xfe) >>> 1)
    )
}
