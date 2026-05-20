/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { STREAM_TYPE_AAC } from '@amazon/vinyl-transmux'
import {
    buildAdtsFrame,
    buildPatPacket,
    buildPesPacket,
    buildPmtPacket,
    concatPackets,
} from './tsPacketBuilder'

/**
 * Builds a minimal MPEG-TS segment containing a PAT, PMT, and one PES packet
 * with ADTS audio data.
 */
export function buildMinimalTsSegment(): Uint8Array {
    const adtsFrame = buildAdtsFrame(100)
    return concatPackets([
        buildPatPacket(0x100),
        buildPmtPacket(0x100, [{ pid: 0x101, streamType: STREAM_TYPE_AAC }]),
        buildPesPacket({
            pid: 0x101,
            streamId: 0xc0,
            payload: adtsFrame,
            pts: 0,
        }),
    ])
}
