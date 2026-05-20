/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A growable binary buffer writer. Writes big-endian by default, matching
 * network byte order used by MP4 and MPEG-TS.
 */
export class BufferWriter {
    private buffer: ArrayBuffer
    private dataView: DataView
    position: number = 0

    constructor(initialCapacity: number = 256) {
        this.buffer = new ArrayBuffer(initialCapacity)
        this.dataView = new DataView(this.buffer)
    }

    private ensureCapacity(additionalBytes: number) {
        const required = this.position + additionalBytes
        if (required <= this.buffer.byteLength) return
        let newCapacity = this.buffer.byteLength
        while (newCapacity < required) newCapacity *= 2
        const newBuffer = new ArrayBuffer(newCapacity)
        new Uint8Array(newBuffer).set(new Uint8Array(this.buffer))
        this.buffer = newBuffer
        this.dataView = new DataView(this.buffer)
    }

    writeUint8(value: number) {
        this.ensureCapacity(1)
        this.dataView.setUint8(this.position++, value)
    }

    writeUint16(value: number, littleEndian?: boolean) {
        this.ensureCapacity(2)
        this.dataView.setUint16(this.position, value, littleEndian)
        this.position += 2
    }

    writeUint32(value: number, littleEndian?: boolean) {
        this.ensureCapacity(4)
        this.dataView.setUint32(this.position, value, littleEndian)
        this.position += 4
    }

    writeInt16(value: number, littleEndian?: boolean) {
        this.ensureCapacity(2)
        this.dataView.setInt16(this.position, value, littleEndian)
        this.position += 2
    }

    writeInt32(value: number, littleEndian?: boolean) {
        this.ensureCapacity(4)
        this.dataView.setInt32(this.position, value, littleEndian)
        this.position += 4
    }

    writeBytes(data: ArrayBuffer | Uint8Array) {
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
        this.ensureCapacity(bytes.byteLength)
        new Uint8Array(this.buffer).set(bytes, this.position)
        this.position += bytes.byteLength
    }

    /**
     * Writes a fixed-length ASCII string.
     */
    writeString(str: string) {
        this.ensureCapacity(str.length)
        for (let i = 0; i < str.length; i++) {
            this.dataView.setUint8(this.position++, str.charCodeAt(i))
        }
    }

    /**
     * Returns the written data as a trimmed ArrayBuffer.
     */
    toArrayBuffer(): ArrayBuffer {
        return this.buffer.slice(0, this.position)
    }

    /**
     * Returns the written data as a Uint8Array view.
     */
    toUint8Array(): Uint8Array {
        return new Uint8Array(this.buffer, 0, this.position)
    }
}
