/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { BufferReader } from '@amazon/vinyl-util'

describe('BufferReader', () => {
    let buffer: ArrayBuffer
    let reader: BufferReader
    let view: DataView

    beforeEach(() => {
        buffer = new ArrayBuffer(32)
        view = new DataView(buffer)
        reader = new BufferReader(buffer)
    })

    describe('assertRemaining', () => {
        it('throws if there is not at least the given number of bytes remaining', () => {
            expect(() => reader.assertRemaining(32)).not.toThrow()
            reader.position += 24
            expect(() => reader.assertRemaining(10)).toThrowError(
                'Unexpected end of buffer reached at position: 24. Reading 10 bytes, 8 available.'
            )
        })
    })

    describe('hasNext', () => {
        it('returns true when there is remaining data', () => {
            expect(reader.hasNext()).toBeTrue()
            reader.skip(31)
            expect(reader.hasNext()).toBeTrue()
            reader.skip(1)
            expect(reader.hasNext()).toBeFalse()
        })
    })

    describe('skip', () => {
        it('increments the position the given number of bytes', () => {
            reader.skip(4)
            expect(reader.position).toBe(4)
            reader.skip(5)
            expect(reader.position).toBe(9)
        })
    })

    describe('readInt8', () => {
        it('reads Int8 values', () => {
            view.setInt8(0, 0xfe)
            view.setInt8(1, 0x0f)
            expect(reader.readInt8()).toEqual(0xfe - 0xff - 1) // twos complement
            expect(reader.readInt8()).toEqual(0x0f)
        })
    })

    describe('readInt16', () => {
        it('should read Int16 correctly', () => {
            view.setInt16(0, 0xffee, true)
            view.setInt16(2, 0x0fee, true)
            view.setInt16(4, 0x1122, false)
            expect(reader.readInt16(true)).toEqual(0xffee - 0xffff - 1) // twos complement
            expect(reader.readInt16(true)).toEqual(0x0fee)
            expect(reader.readInt16(false)).toEqual(0x1122)
        })
    })

    describe('readInt32', () => {
        it('should read Int32 correctly', () => {
            view.setInt32(0, 0xff23ee, true)
            view.setInt32(4, 0x112322, false)
            expect(reader.readInt32(true)).toEqual(0xff23ee)
            expect(reader.readInt32(false)).toEqual(0x112322)
        })
    })

    describe('readInt64', () => {
        beforeEach(() => {
            if (typeof BigInt === 'undefined') {
                pending('BigInt not supported')
            }
        })

        it('should read Int64 correctly', () => {
            view.setBigInt64(0, BigInt('0xdeadbeef'), true)
            view.setBigInt64(8, BigInt('0x1122334455667788'), false)
            expect(reader.readInt64(true)).toEqual(BigInt('0xdeadbeef'))
            expect(reader.readInt64(false)).toEqual(
                BigInt('0x1122334455667788')
            )
        })
    })

    describe('readFloat32', () => {
        it('should read Int32 correctly', () => {
            view.setFloat32(0, 1.23, true)
            view.setFloat32(4, 4.56, false)
            expect(reader.readFloat32(true)).toBeCloseTo(1.23)
            expect(reader.readFloat32(false)).toBeCloseTo(4.56)
        })
    })

    describe('readFloat64', () => {
        it('should read Float64 correctly', () => {
            view.setFloat64(0, 1.234567, true)
            view.setFloat64(8, 8.765432, false)
            expect(reader.readFloat64(true)).toBeCloseTo(1.234567)
            expect(reader.readFloat64(false)).toBeCloseTo(8.765432)
        })
    })

    describe('readUint8', () => {
        it('should read Uint8 correctly', () => {
            view.setUint8(0, 0xff)
            view.setUint8(1, 0xee)
            expect(reader.readUint8()).toEqual(0xff)
            expect(reader.readUint8()).toEqual(0xee)
        })
    })

    describe('readUint16', () => {
        it('should read Uint16 correctly', () => {
            view.setUint16(0, 0xff42, true)
            view.setUint16(2, 0xee21)
            expect(reader.readUint16(true)).toEqual(0xff42)
            expect(reader.readUint16()).toEqual(0xee21)
        })
    })

    describe('readUint32', () => {
        it('should read Uint32 correctly', () => {
            view.setUint32(0, 0xff421234)
            view.setUint32(4, 0xee214422, true)
            expect(reader.readUint32()).toEqual(0xff421234)
            expect(reader.readUint32(true)).toEqual(0xee214422)
        })
    })

    describe('readUint64', () => {
        beforeEach(() => {
            if (typeof BigInt === 'undefined') {
                pending('BigInt not supported')
            }
        })

        it('should read Uint64 correctly', () => {
            view.setBigUint64(0, BigInt('0xff421234ff4ab234'))
            view.setBigUint64(8, BigInt('0xee214422ee2aabb2'), true)
            expect(reader.readUint64()).toEqual(BigInt('0xff421234ff4ab234'))
            expect(reader.readUint64(true)).toEqual(
                BigInt('0xee214422ee2aabb2')
            )
        })
    })

    describe('readBytes', () => {
        it('reads the given number of bytes', () => {
            view.setUint32(0, 0xdeadbeef, true)
            view.setUint32(4, 0xbaddadda, true)
            view.setUint32(8, 0xabcdefab, true)
            const arr = new Uint32Array(reader.readBytes(8))
            expect(reader.position).toEqual(8)
            expect(arr[0]).toEqual(0xdeadbeef)
            expect(arr[1]).toEqual(0xbaddadda)
            expect(new Uint32Array(reader.readBytes(4))[0]).toEqual(0xabcdefab)
        })
    })

    describe('readString', () => {
        it('reads the given number of bytes into a byte string', () => {
            const str = 'test me'
            for (let i = 0; i < str.length; i++) {
                view.setUint8(i, str.charCodeAt(i))
            }
            expect(reader.readString(4)).toEqual('test')
            reader.skip(1)
            expect(reader.readString(2)).toEqual('me')
        })
    })

    describe('readUtf16String', () => {
        it('reads the given number of bytes into a utf-16 string', () => {
            const str = 'Hello 😂'
            for (let i = 0; i < str.length; i++) {
                view.setUint16(i * 2, str.charCodeAt(i), true)
            }
            expect(reader.readUtf16String(str.length * 2)).toEqual(str)
        })
    })
})
