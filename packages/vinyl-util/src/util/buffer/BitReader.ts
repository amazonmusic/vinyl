/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { BufferError } from './BufferError'

/**
 * Reads big-endian bit fields, for bit-packed syntax such as MPEG sections
 * whose fields are not byte aligned. For byte-aligned data, use
 * {@link BufferReader}.
 *
 * Fields of up to 53 bits are read exactly.
 */
export class BitReader {
    /**
     * The position in bits.
     */
    position = 0

    constructor(private readonly data: ArrayLike<number>) {}

    /**
     * The position in bytes, rounded up to the next byte boundary.
     */
    get bytePosition(): number {
        return Math.ceil(this.position / 8)
    }

    /**
     * The number of bits remaining.
     */
    get remaining(): number {
        return this.data.length * 8 - this.position
    }

    /**
     * Moves to the given byte position.
     */
    seek(bytePosition: number): void {
        this.position = bytePosition * 8
    }

    skip(bits: number): void {
        this.position += bits
    }

    /**
     * Reads a single bit as a boolean.
     */
    readFlag(): boolean {
        return this.readBits(1) === 1
    }

    /**
     * Reads an unsigned value of `count` bits.
     */
    readBits(count: number): number {
        if (count > this.remaining)
            throw new BufferError(
                `Unexpected end of buffer reached at bit: ${this.position}. Reading ${count} bits, ${this.remaining} available.`
            )
        let value = 0
        for (let i = 0; i < count; i++) {
            const byte = this.data[this.position >> 3]
            const bit = (byte >> (7 - (this.position & 7))) & 1
            // Multiplication rather than a shift keeps fields over 31 bits exact.
            value = value * 2 + bit
            this.position++
        }
        return value
    }

    /**
     * Reads `count` bytes, which need not be byte aligned.
     */
    readBytes(count: number): Uint8Array {
        const out = new Uint8Array(count)
        for (let i = 0; i < count; i++) out[i] = this.readBits(8)
        return out
    }
}
