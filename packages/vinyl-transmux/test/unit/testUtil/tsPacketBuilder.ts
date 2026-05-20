/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { TS_PACKET_SIZE, TS_SYNC_BYTE } from '@amazon/vinyl-transmux'

/**
 * Shared TS packet construction utilities for transmux tests.
 */

export function buildPatPacket(pmtPid: number): Uint8Array {
    const pkt = new Uint8Array(TS_PACKET_SIZE)
    pkt[0] = TS_SYNC_BYTE
    pkt[1] = 0x40
    pkt[3] = 0x10
    let p = 4
    pkt[p++] = 0x00
    pkt[p++] = 0x00
    pkt[p++] = 0xb0
    pkt[p++] = 0x09
    pkt[p++] = 0x00
    pkt[p++] = 0x01
    pkt[p++] = 0xc1
    pkt[p++] = 0x00
    pkt[p++] = 0x00
    pkt[p++] = 0x00
    pkt[p++] = 0x01
    pkt[p++] = (pmtPid >> 8) & 0x1f
    pkt[p++] = pmtPid & 0xff
    for (let i = p; i < TS_PACKET_SIZE; i++) pkt[i] = 0xff
    return pkt
}

export function buildPmtPacket(
    pmtPid: number,
    streams: { pid: number; streamType: number }[]
): Uint8Array {
    const pkt = new Uint8Array(TS_PACKET_SIZE)
    pkt[0] = TS_SYNC_BYTE
    pkt[1] = 0x40 | ((pmtPid >> 8) & 0x1f)
    pkt[2] = pmtPid & 0xff
    pkt[3] = 0x10
    let p = 4
    pkt[p++] = 0x00
    const ss = p
    pkt[p++] = 0x02
    p += 2
    pkt[p++] = 0x00
    pkt[p++] = 0x01
    pkt[p++] = 0xc1
    pkt[p++] = 0x00
    pkt[p++] = 0x00
    pkt[p++] = 0xe0 | ((streams[0].pid >> 8) & 0x1f)
    pkt[p++] = streams[0].pid & 0xff
    pkt[p++] = 0xf0
    pkt[p++] = 0x00
    for (const s of streams) {
        pkt[p++] = s.streamType
        pkt[p++] = 0xe0 | ((s.pid >> 8) & 0x1f)
        pkt[p++] = s.pid & 0xff
        pkt[p++] = 0xf0
        pkt[p++] = 0x00
    }
    const sl = p - ss - 3 + 4
    pkt[ss + 1] = 0xb0 | ((sl >> 8) & 0x0f)
    pkt[ss + 2] = sl & 0xff
    for (let i = p; i < TS_PACKET_SIZE; i++) pkt[i] = 0xff
    return pkt
}

export interface PesOptions {
    readonly pid: number
    readonly streamId: number
    readonly payload: Uint8Array
    /** PTS in 90kHz ticks. Omit for no PTS. */
    readonly pts?: number
    /** If true, use non-zero PES packet length. Default: false (unbounded). */
    readonly knownLength?: boolean
}

export function buildPesPacket(opts: PesOptions): Uint8Array {
    const pkt = new Uint8Array(TS_PACKET_SIZE)
    pkt[0] = TS_SYNC_BYTE
    pkt[1] = 0x40 | ((opts.pid >> 8) & 0x1f)
    pkt[2] = opts.pid & 0xff
    pkt[3] = 0x10
    let p = 4
    pkt[p++] = 0x00 // start code
    pkt[p++] = 0x00
    pkt[p++] = 0x01
    pkt[p++] = opts.streamId

    const hasPts = opts.pts != null
    const headerDataLen = hasPts ? 5 : 0

    if (opts.knownLength) {
        const pesPayloadLen = 3 + headerDataLen + opts.payload.byteLength
        pkt[p++] = (pesPayloadLen >> 8) & 0xff
        pkt[p++] = pesPayloadLen & 0xff
    } else {
        pkt[p++] = 0x00
        pkt[p++] = 0x00
    }

    pkt[p++] = 0x80
    pkt[p++] = hasPts ? 0x80 : 0x00
    pkt[p++] = headerDataLen

    if (hasPts) {
        const pts = opts.pts
        pkt[p++] = 0x21 | (((pts >> 29) & 0x0e) << 1)
        pkt[p++] = (pts >> 22) & 0xff
        pkt[p++] = 0x01 | ((pts >> 14) & 0xfe)
        pkt[p++] = (pts >> 7) & 0xff
        pkt[p++] = 0x01 | ((pts & 0x7f) << 1)
    }

    const rem = TS_PACKET_SIZE - p
    pkt.set(opts.payload.subarray(0, Math.min(opts.payload.byteLength, rem)), p)
    return pkt
}

export function concatArrays(...arrays: Uint8Array[]): Uint8Array {
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

export function concatPackets(packets: Uint8Array[]): Uint8Array {
    const result = new Uint8Array(packets.length * TS_PACKET_SIZE)
    for (let i = 0; i < packets.length; i++) {
        result.set(packets[i], i * TS_PACKET_SIZE)
    }
    return result
}

export function buildAdtsFrame(payloadSize: number): Uint8Array {
    const frameLength = 7 + payloadSize
    const frame = new Uint8Array(frameLength)
    frame[0] = 0xff
    frame[1] = 0xf1
    frame[2] = (1 << 6) | (4 << 2)
    frame[3] = (2 << 6) | ((frameLength >> 11) & 0x03)
    frame[4] = (frameLength >> 3) & 0xff
    frame[5] = ((frameLength & 0x07) << 5) | 0x1f
    frame[6] = 0xfc
    for (let i = 7; i < frameLength; i++) frame[i] = 0xab
    return frame
}
