/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Bitstream writer for constructing exp-golomb encoded SPS NAL units.
 */
export class BitstreamWriter {
    private bits: number[] = []

    writeBit(b: number): void {
        this.bits.push(b & 1)
    }

    writeBits(value: number, count: number): void {
        for (let i = count - 1; i >= 0; i--) {
            this.bits.push((value >> i) & 1)
        }
    }

    /** Writes an unsigned exp-golomb coded value. */
    writeUe(value: number): void {
        const code = value + 1
        const len = Math.floor(Math.log2(code))
        for (let i = 0; i < len; i++) this.writeBit(0)
        this.writeBits(code, len + 1)
    }

    /** Writes a signed exp-golomb coded value. */
    writeSe(value: number): void {
        if (value > 0) this.writeUe(2 * value - 1)
        else if (value < 0) this.writeUe(-2 * value)
        else this.writeUe(0)
    }

    toUint8Array(): Uint8Array {
        const byteCount = Math.ceil(this.bits.length / 8)
        const result = new Uint8Array(byteCount)
        for (let i = 0; i < this.bits.length; i++) {
            if (this.bits[i]) {
                result[i >> 3] |= 1 << (7 - (i & 7))
            }
        }
        return result
    }
}

/**
 * Builds an SPS NAL unit with the given parameters.
 */
export function buildSps(opts: {
    profileIdc: number
    levelIdc: number
    chromaFormatIdc?: number
    bitDepthLumaMinus8?: number
    bitDepthChromaMinus8?: number
    seqScalingMatrixPresent?: boolean
    log2MaxFrameNumMinus4?: number
    picOrderCntType?: number
    log2MaxPicOrderCntLsbMinus4?: number
    numRefFramesInPocCycle?: number
    maxNumRefFrames?: number
    picWidthInMbsMinus1: number
    picHeightInMapUnitsMinus1: number
    frameMbsOnly?: boolean
}): Uint8Array {
    const w = new BitstreamWriter()

    // profile_idc, constraint flags, level_idc
    w.writeBits(opts.profileIdc, 8)
    w.writeBits(0, 8) // constraint flags
    w.writeBits(opts.levelIdc, 8)

    // seq_parameter_set_id
    w.writeUe(0)

    // High profile extensions
    const isHighProfile = [
        100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134,
    ].includes(opts.profileIdc)
    if (isHighProfile) {
        const chroma = opts.chromaFormatIdc ?? 1
        w.writeUe(chroma)
        if (chroma === 3) w.writeBit(0) // separate_colour_plane_flag
        w.writeUe(opts.bitDepthLumaMinus8 ?? 0)
        w.writeUe(opts.bitDepthChromaMinus8 ?? 0)
        w.writeBit(0) // qpprime_y_zero_transform_bypass
        const scalingMatrix = opts.seqScalingMatrixPresent ?? false
        w.writeBit(scalingMatrix ? 1 : 0)
        if (scalingMatrix) {
            // First list (4x4, size=16) present with delta=-8 to make nextScale=0.
            // 7th list (8x8, size=64) present with all-zero deltas.
            // This exercises both size=16 and size=64 branches.
            const count = chroma !== 3 ? 8 : 12
            // List 0: present
            w.writeBit(1)
            w.writeSe(-8) // delta=-8 → nextScale=0
            for (let j = 1; j < 16; j++) w.writeSe(0)
            // Lists 1-5: absent
            for (let i = 1; i < 6; i++) w.writeBit(0)
            // List 6: present (8x8, size=64)
            w.writeBit(1)
            for (let j = 0; j < 64; j++) w.writeSe(0)
            // Remaining lists: absent
            for (let i = 7; i < count; i++) w.writeBit(0)
        }
    }

    w.writeUe(opts.log2MaxFrameNumMinus4 ?? 0)

    const pocType = opts.picOrderCntType ?? 0
    w.writeUe(pocType)
    if (pocType === 0) {
        w.writeUe(opts.log2MaxPicOrderCntLsbMinus4 ?? 0)
    } else if (pocType === 1) {
        w.writeBit(0) // delta_pic_order_always_zero_flag
        w.writeSe(-1) // offset_for_non_ref_pic (negative → exercises readSe negative branch)
        w.writeSe(0) // offset_for_top_to_bottom_field
        const numRef = opts.numRefFramesInPocCycle ?? 1
        w.writeUe(numRef) // num_ref_frames_in_pic_order_cnt_cycle
        for (let i = 0; i < numRef; i++) w.writeSe(0)
    }

    w.writeUe(opts.maxNumRefFrames ?? 0)
    w.writeBit(0) // gaps_in_frame_num_value_allowed

    w.writeUe(opts.picWidthInMbsMinus1)
    w.writeUe(opts.picHeightInMapUnitsMinus1)
    w.writeBit(opts.frameMbsOnly !== false ? 1 : 0)

    const body = w.toUint8Array()
    // Prepend NAL header byte (type=7, nal_ref_idc=3)
    const nal = new Uint8Array(1 + body.byteLength)
    nal[0] = 0x67
    nal.set(body, 1)
    return nal
}
