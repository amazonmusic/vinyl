/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { BitReader, BufferError } from '@amazon/vinyl-util'

describe('BitReader', () => {
    it('reads unaligned big-endian fields', () => {
        const reader = new BitReader([0b1011_0011, 0b0101_1111])
        expect(reader.readFlag()).toBeTrue()
        expect(reader.readBits(3)).toBe(0b011)
        expect(reader.readBits(6)).toBe(0b0011_01)
        expect(reader.bytePosition).toBe(2)
        expect(reader.remaining).toBe(6)
        expect(reader.readBits(6)).toBe(0b01_1111)
        expect(reader.remaining).toBe(0)
    })

    it('reads fields wider than 32 bits exactly', () => {
        const reader = new BitReader([0xff, 0xff, 0xff, 0xff, 0xff, 0x80])
        reader.skip(7)
        expect(reader.readBits(33)).toBe(2 ** 33 - 1)
    })

    it('seeks and reads unaligned bytes', () => {
        const reader = new BitReader(new Uint8Array([0x0f, 0xf0, 0xab]))
        reader.skip(4)
        expect(reader.readBytes(1)).toEqual(new Uint8Array([0xff]))
        reader.seek(2)
        expect(reader.position).toBe(16)
        expect(reader.readBytes(1)).toEqual(new Uint8Array([0xab]))
    })

    it('throws at the end of the buffer', () => {
        const reader = new BitReader([0])
        reader.skip(4)
        expect(() => reader.readBits(5)).toThrowError(
            BufferError,
            'Unexpected end of buffer reached at bit: 4. Reading 5 bits, 4 available.'
        )
    })
})
