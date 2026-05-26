/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { bufferToByteStr, bufferToUtf16 } from '@/util/buffer/buffer'
import { BufferError } from '@/util/buffer/BufferError'

export class BufferReader {
    position: number = 0

    private dataView: DataView<ArrayBuffer>

    constructor(buffer: ArrayBuffer) {
        this.dataView = new DataView(buffer)
    }

    /**
     * Asserts that at least `size` bytes are remaining.
     * @param size
     */
    assertRemaining(size: number) {
        if (this.remaining < size) {
            throw new BufferError(
                `Unexpected end of buffer reached at position: ${this.position}. Reading ${size} bytes, ${this.remaining} available.`
            )
        }
    }

    hasNext(): boolean {
        return this.remaining > 0
    }

    get remaining(): number {
        return this.dataView.byteLength - this.position
    }

    skip(bytes: number) {
        this.assertRemaining(bytes)
        this.position += bytes
    }

    /**
     * Reads the next Float32 value.
     * @param littleEndian If false or undefined, a big-endian value should be read.
     */
    readFloat32(littleEndian?: boolean): number {
        this.assertRemaining(4)
        const value = this.dataView.getFloat32(this.position, littleEndian)
        this.position += 4
        return value
    }

    /**
     * Reads the next Float64 value.
     * @param littleEndian If false or undefined, a big-endian value should be read.
     */
    readFloat64(littleEndian?: boolean): number {
        this.assertRemaining(8)
        const value = this.dataView.getFloat64(this.position, littleEndian)
        this.position += 8
        return value
    }

    /**
     * Reads the next Int8 value.
     */
    readInt8(): number {
        this.assertRemaining(1)
        return this.dataView.getInt8(this.position++)
    }

    /**
     * Reads the next Int16 value.
     * @param littleEndian If false or undefined, a big-endian value should be read.
     */
    readInt16(littleEndian?: boolean): number {
        this.assertRemaining(2)
        const value = this.dataView.getInt16(this.position, littleEndian)
        this.position += 2
        return value
    }

    /**
     * Reads the next Int32 value.
     * @param littleEndian If false or undefined, a big-endian value should be read.
     */
    readInt32(littleEndian?: boolean): number {
        this.assertRemaining(4)
        const value = this.dataView.getInt32(this.position, littleEndian)
        this.position += 4
        return value
    }

    /**
     * Reads the next Int64 value.
     * @param littleEndian If false or undefined, a big-endian value should be read.
     */
    readInt64(littleEndian?: boolean): bigint {
        this.assertRemaining(8)
        const value = this.dataView.getBigInt64(this.position, littleEndian)
        this.position += 8
        return value
    }

    /**
     * Reads the next Uint8 value.
     */
    readUint8(): number {
        this.assertRemaining(1)
        return this.dataView.getUint8(this.position++)
    }

    /**
     * Reads the next Uint16 value.
     * @param littleEndian If false or undefined, a big-endian value should be read.
     */
    readUint16(littleEndian?: boolean): number {
        this.assertRemaining(2)
        const value = this.dataView.getUint16(this.position, littleEndian)
        this.position += 2
        return value
    }

    /**
     * Reads the next Uint32 value.
     * @param littleEndian If false or undefined, a big-endian value should be read.
     */
    readUint32(littleEndian?: boolean): number {
        this.assertRemaining(4)
        const value = this.dataView.getUint32(this.position, littleEndian)
        this.position += 4
        return value
    }

    /**
     * Reads the next Uint64 value.
     * @param littleEndian If false or undefined, a big-endian value should be read.
     */
    readUint64(littleEndian?: boolean): bigint {
        this.assertRemaining(8)
        const value = this.dataView.getBigUint64(this.position, littleEndian)
        this.position += 8
        return value
    }

    /**
     * Reads from the current position into a sliced array buffer of the given size.
     * @param count
     */
    readBytes(count: number): ArrayBuffer {
        this.assertRemaining(count)
        const buffer = this.dataView.buffer.slice(
            this.position,
            this.position + count
        )
        this.position += count
        return buffer
    }

    /**
     * Reads the given number of characters into a byte string.
     * @param length
     */
    readString(length: number): string {
        return bufferToByteStr(this.readBytes(length))
    }

    /**
     * Reads the given number of characters into a UTF-16 string.
     * @param length
     */
    readUtf16String(length: number): string {
        return bufferToUtf16(this.readBytes(length))
    }
}
