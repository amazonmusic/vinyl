/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { STREAM_TYPE_H264 } from '@amazon/vinyl-transmux'
import {
    buildPatPacket,
    buildPesPacket,
    buildPmtPacket,
    concatArrays,
    concatPackets,
} from './tsPacketBuilder'

/**
 * Builds a minimal MPEG-TS segment containing a single H.264 IDR frame
 * with a High profile SPS (profile_idc=100). Exercises the SPS parser's
 * high-profile branch.
 */
export function buildHighProfileTsSegment(): Uint8Array {
    const sps = new Uint8Array([
        0x67, 0x64, 0x00, 0x28, 0xe4, 0x00, 0x11, 0xe2, 0x00, 0x00,
    ])
    const pps = new Uint8Array([0x68, 0xce, 0x38, 0x80])
    const idr = new Uint8Array([0x65, 0x88, 0x80, 0x40])

    const payload = concatArrays(
        new Uint8Array([0x00, 0x00, 0x00, 0x01]),
        sps,
        new Uint8Array([0x00, 0x00, 0x00, 0x01]),
        pps,
        new Uint8Array([0x00, 0x00, 0x00, 0x01]),
        idr
    )

    return concatPackets([
        buildPatPacket(0x100),
        buildPmtPacket(0x100, [{ pid: 0x101, streamType: STREAM_TYPE_H264 }]),
        buildPesPacket({ pid: 0x101, streamId: 0xe0, payload, pts: 0 }),
    ])
}
