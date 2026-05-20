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
import { buildSps } from './spsBuilder'

/**
 * Builds a TS segment with a High profile SPS that has
 * seqScalingMatrixPresent=1 and chromaFormatIdc=3.
 */
export function buildScalingMatrixTsSegment(): Uint8Array {
    return buildVideoTsFromSps(
        buildSps({
            profileIdc: 100,
            levelIdc: 40,
            chromaFormatIdc: 3,
            seqScalingMatrixPresent: true,
            picWidthInMbsMinus1: 7,
            picHeightInMapUnitsMinus1: 7,
        })
    )
}

/**
 * Builds a TS segment with High profile, chroma=1, scaling matrix present.
 */
export function buildScalingMatrixChroma1TsSegment(): Uint8Array {
    return buildVideoTsFromSps(
        buildSps({
            profileIdc: 100,
            levelIdc: 40,
            chromaFormatIdc: 1,
            seqScalingMatrixPresent: true,
            picWidthInMbsMinus1: 7,
            picHeightInMapUnitsMinus1: 7,
        })
    )
}

/**
 * Builds a TS segment with pic_order_cnt_type=1 SPS.
 */
export function buildPocType1TsSegment(): Uint8Array {
    return buildVideoTsFromSps(
        buildSps({
            profileIdc: 66,
            levelIdc: 30,
            picOrderCntType: 1,
            picWidthInMbsMinus1: 7,
            picHeightInMapUnitsMinus1: 7,
        })
    )
}

function buildVideoTsFromSps(sps: Uint8Array): Uint8Array {
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
        buildPesPacket({ pid: 0x101, streamId: 0xe0, payload }),
    ])
}
