/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { BufferWriter } from '@amazon/vinyl-util'

describe('BufferWriter', () => {
    it('writes and reads uint8', () => {
        const w = new BufferWriter(4)
        w.writeUint8(0xff)
        expect(w.toUint8Array()).toEqual(new Uint8Array([0xff]))
    })

    it('writes and reads uint16', () => {
        const w = new BufferWriter(4)
        w.writeUint16(0x1234)
        expect(w.toUint8Array()).toEqual(new Uint8Array([0x12, 0x34]))
    })

    it('writes and reads uint32', () => {
        const w = new BufferWriter(4)
        w.writeUint32(0x12345678)
        expect(w.toUint8Array()).toEqual(
            new Uint8Array([0x12, 0x34, 0x56, 0x78])
        )
    })

    it('writes int16', () => {
        const w = new BufferWriter(4)
        w.writeInt16(-1)
        expect(w.toUint8Array()).toEqual(new Uint8Array([0xff, 0xff]))
    })

    it('writes int32', () => {
        const w = new BufferWriter(4)
        w.writeInt32(-1)
        expect(w.toUint8Array()).toEqual(
            new Uint8Array([0xff, 0xff, 0xff, 0xff])
        )
    })

    it('writes bytes from Uint8Array', () => {
        const w = new BufferWriter(4)
        w.writeBytes(new Uint8Array([0xaa, 0xbb]))
        expect(w.toUint8Array()).toEqual(new Uint8Array([0xaa, 0xbb]))
    })

    it('writes bytes from ArrayBuffer', () => {
        const w = new BufferWriter(4)
        w.writeBytes(new Uint8Array([0xcc, 0xdd]).buffer)
        expect(w.toUint8Array()).toEqual(new Uint8Array([0xcc, 0xdd]))
    })

    it('writes ASCII string', () => {
        const w = new BufferWriter(4)
        w.writeString('ftyp')
        expect(w.toUint8Array()).toEqual(
            new Uint8Array([0x66, 0x74, 0x79, 0x70])
        )
    })

    it('grows the buffer when capacity is exceeded', () => {
        const w = new BufferWriter(2)
        w.writeUint32(0x12345678)
        expect(w.toUint8Array()).toEqual(
            new Uint8Array([0x12, 0x34, 0x56, 0x78])
        )
    })

    it('grows multiple times for large writes', () => {
        const w = new BufferWriter(1)
        const data = new Uint8Array(100)
        for (let i = 0; i < 100; i++) data[i] = i
        w.writeBytes(data)
        expect(w.toUint8Array()).toEqual(data)
    })

    it('returns an ArrayBuffer via toArrayBuffer', () => {
        const w = new BufferWriter(16)
        w.writeUint8(0xab)
        w.writeUint8(0xcd)
        const buf = w.toArrayBuffer()
        expect(buf.byteLength).toBe(2)
        expect(new Uint8Array(buf)).toEqual(new Uint8Array([0xab, 0xcd]))
    })

    it('tracks position correctly across mixed writes', () => {
        const w = new BufferWriter(32)
        w.writeUint8(1)
        w.writeUint16(2)
        w.writeUint32(3)
        w.writeString('ab')
        w.writeBytes(new Uint8Array([0xff]))
        expect(w.position).toBe(1 + 2 + 4 + 2 + 1)
    })
})
