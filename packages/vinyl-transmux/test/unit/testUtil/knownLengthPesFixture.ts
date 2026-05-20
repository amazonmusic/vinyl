/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { STREAM_TYPE_H264, STREAM_TYPE_AAC } from '@amazon/vinyl-transmux'
import {
    buildAdtsFrame,
    buildPatPacket,
    buildPesPacket,
    buildPmtPacket,
    concatArrays,
    concatPackets,
} from './tsPacketBuilder'

/**
 * Builds a TS segment with two unbounded (length=0) video PES packets.
 * Exercises the extractElementaryStream scan-for-next-PES-header branch.
 * Uses identical PTS values to produce 0 deltas (exercises `|| 3754`).
 */
export function buildMultiPesTsSegment(): Uint8Array {
    const sps = new Uint8Array([
        0x67, 0x42, 0xc0, 0x1e, 0xd9, 0x00, 0xa0, 0x47, 0xfe, 0xc8,
    ])
    const pps = new Uint8Array([0x68, 0xce, 0x38, 0x80])
    const idr = new Uint8Array([0x65, 0x88, 0x80, 0x40])
    const nonIdr = new Uint8Array([0x41, 0x9a, 0x00, 0x20])

    return concatPackets([
        buildPatPacket(0x100),
        buildPmtPacket(0x100, [{ pid: 0x101, streamType: STREAM_TYPE_H264 }]),
        buildPesPacket({
            pid: 0x101,
            streamId: 0xe0,
            pts: 0,
            payload: concatArrays(
                new Uint8Array([0x00, 0x00, 0x01]),
                sps,
                new Uint8Array([0x00, 0x00, 0x01]),
                pps,
                new Uint8Array([0x00, 0x00, 0x01]),
                idr
            ),
        }),
        buildPesPacket({
            pid: 0x101,
            streamId: 0xe0,
            pts: 0,
            payload: concatArrays(new Uint8Array([0x00, 0x00, 0x01]), nonIdr),
        }),
    ])
}

/**
 * Builds a TS segment with PES packets that have known (non-zero) packet
 * lengths. Includes SEI + non-IDR + bare non-IDR for branch coverage.
 */
export function buildKnownLengthPesTsSegment(): Uint8Array {
    const sps = new Uint8Array([
        0x67, 0x42, 0xc0, 0x1e, 0xd9, 0x00, 0xa0, 0x47, 0xfe, 0xc8,
    ])
    const pps = new Uint8Array([0x68, 0xce, 0x38, 0x80])
    const idr = new Uint8Array([0x65, 0x88, 0x80, 0x40])
    const sei = new Uint8Array([0x06, 0x05, 0x01, 0x00])
    const nonIdr = new Uint8Array([0x41, 0x9a, 0x00, 0x20])
    const nonIdr2 = new Uint8Array([0x41, 0x9a, 0x00, 0x30])

    return concatPackets([
        buildPatPacket(0x100),
        buildPmtPacket(0x100, [
            { pid: 0x101, streamType: STREAM_TYPE_H264 },
            { pid: 0x102, streamType: STREAM_TYPE_AAC },
        ]),
        buildPesPacket({
            pid: 0x101,
            streamId: 0xe0,
            pts: 0,
            knownLength: true,
            payload: concatArrays(
                new Uint8Array([0x00, 0x00, 0x01]),
                sps,
                new Uint8Array([0x00, 0x00, 0x01]),
                pps,
                new Uint8Array([0x00, 0x00, 0x01]),
                idr
            ),
        }),
        buildPesPacket({
            pid: 0x101,
            streamId: 0xe0,
            pts: 3754,
            knownLength: true,
            payload: concatArrays(
                new Uint8Array([0x00, 0x00, 0x01]),
                sei,
                new Uint8Array([0x00, 0x00, 0x01]),
                nonIdr,
                new Uint8Array([0x00, 0x00, 0x01]),
                nonIdr2
            ),
        }),
        buildPesPacket({
            pid: 0x102,
            streamId: 0xc0,
            pts: 0,
            knownLength: true,
            payload: buildAdtsFrame(50),
        }),
    ])
}
