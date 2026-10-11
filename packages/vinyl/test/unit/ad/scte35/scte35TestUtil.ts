/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A minimal SCTE-35 `splice_info_section` encoder for tests. The CRC is
 * written as zero; the decoder does not verify it.
 */

class BitWriter {
    private readonly bits: number[] = []

    write(value: number, count: number): this {
        for (let i = count - 1; i >= 0; i--) {
            this.bits.push(Math.floor(value / 2 ** i) % 2)
        }
        return this
    }

    flag(value: boolean): this {
        return this.write(value ? 1 : 0, 1)
    }

    bytes(): number[] {
        const out: number[] = []
        for (let i = 0; i < this.bits.length; i += 8) {
            let byte = 0
            for (let j = 0; j < 8; j++)
                byte = byte * 2 + (this.bits[i + j] ?? 0)
            out.push(byte)
        }
        return out
    }
}

function spliceTime(w: BitWriter, ptsTime: number | null) {
    if (ptsTime == null) w.flag(false).write(0x7f, 7)
    else w.flag(true).write(0x3f, 6).write(ptsTime, 33)
}

export interface SpliceInsertOptions {
    readonly eventId: number
    readonly outOfNetwork: boolean
    readonly ptsTime?: number | null
    readonly breakDuration?: number | null
    readonly cancel?: boolean
    readonly immediate?: boolean
}

export function spliceInsertCommand(options: SpliceInsertOptions): number[] {
    const w = new BitWriter()
    w.write(options.eventId, 32)
        .flag(options.cancel ?? false)
        .write(0x7f, 7)
    if (!options.cancel) {
        const duration = options.breakDuration ?? null
        w.flag(options.outOfNetwork)
            .flag(true) // program_splice_flag
            .flag(duration != null)
            .flag(options.immediate ?? false)
            .write(0xf, 4)
        if (!options.immediate) spliceTime(w, options.ptsTime ?? null)
        if (duration != null) w.flag(true).write(0x3f, 6).write(duration, 33)
        w.write(1, 16).write(0, 8).write(0, 8)
    }
    return w.bytes()
}

export function timeSignalCommand(ptsTime: number | null): number[] {
    const w = new BitWriter()
    spliceTime(w, ptsTime)
    return w.bytes()
}

export interface SegmentationOptions {
    readonly eventId: number
    readonly typeId: number
    readonly duration?: number | null
    readonly upidType?: number
    readonly upid?: readonly number[]
    readonly cancel?: boolean
}

export function segmentationDescriptor(options: SegmentationOptions): number[] {
    const w = new BitWriter()
    w.write(0x43554549, 32) // CUEI
        .write(options.eventId, 32)
        .flag(options.cancel ?? false)
        .write(0x7f, 7)
    if (!options.cancel) {
        const duration = options.duration ?? null
        const upid = options.upid ?? []
        w.flag(true) // program_segmentation_flag
            .flag(duration != null)
            .flag(true) // delivery_not_restricted_flag
            .write(0x1f, 5)
        if (duration != null) w.write(duration, 40)
        w.write(options.upidType ?? 0, 8).write(upid.length, 8)
        for (const byte of upid) w.write(byte, 8)
        w.write(options.typeId, 8).write(1, 8).write(1, 8)
    }
    const body = w.bytes()
    return [0x02, body.length, ...body]
}

export function spliceInfoSection(options: {
    readonly commandType: number
    readonly command: readonly number[]
    readonly descriptors?: readonly (readonly number[])[]
    readonly ptsAdjustment?: number
}): Uint8Array<ArrayBuffer> {
    const descriptorBytes = (options.descriptors ?? []).flat()
    const body = new BitWriter()
        .write(0, 8) // protocol_version
        .flag(false) // encrypted_packet
        .write(0, 6)
        .write(options.ptsAdjustment ?? 0, 33)
        .write(0, 8) // cw_index
        .write(0xfff, 12) // tier
        .write(options.command.length, 12)
        .write(options.commandType, 8)
        .bytes()
    const rest = [
        ...body,
        ...options.command,
        descriptorBytes.length >> 8,
        descriptorBytes.length & 0xff,
        ...descriptorBytes,
        0,
        0,
        0,
        0, // CRC_32
    ]
    const header = new BitWriter()
        .write(0xfc, 8)
        .write(0, 1) // section_syntax_indicator
        .write(0, 1) // private_indicator
        .write(3, 2) // sap_type
        .write(rest.length, 12)
        .bytes()
    return new Uint8Array([...header, ...rest])
}

export function toHex(bytes: Uint8Array): string {
    return (
        '0x' +
        Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase()
    )
}

export function toBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes))
}

/** A hex `splice_insert` section. */
export function spliceInsertHex(options: SpliceInsertOptions): string {
    return toHex(
        spliceInfoSection({
            commandType: 0x05,
            command: spliceInsertCommand(options),
        })
    )
}
