/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    base64ToByteArray,
    buffersEqual,
    bufferToArrayBuffer,
    bufferToBase64,
    bufferToByteArray,
    bufferToByteStr,
    bufferToUtf16,
    byteStrToByteArray,
    utf16ToUint16Array,
} from '@amazon/vinyl-util'
import { expectIterableEquals } from '@amazon/vinyl-util/browserTestUtil'

describe('buffer utils', () => {
    describe('bufferToByteStr', () => {
        it('converts a buffer to a byte string', () => {
            expect(
                bufferToByteStr([
                    72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33,
                ])
            ).toEqual('Hello World!')
        })
    })

    describe('byteStrToByteArray', () => {
        it('converts a byte string to a byte array', () => {
            expectIterableEquals(
                byteStrToByteArray('Hello World!'),
                [72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]
            )
        })
    })

    describe('bufferToUtf16', () => {
        it('converts a buffer to a utf-16 string', () => {
            expect(
                bufferToUtf16([72, 101, 108, 108, 111, 32, 55357, 56834])
            ).toBe('Hello 😂')
        })
    })

    describe('bufferToBase64', () => {
        it('converts a binary buffer to Base64 text', () => {
            expect(
                bufferToBase64([
                    72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33,
                ])
            ).toBe(global.btoa('Hello World!'))
        })
    })

    describe('base64ToByteArray', () => {
        it('converts Base64 text to binary data', () => {
            expectIterableEquals(
                base64ToByteArray(global.btoa('Hello World!')),
                [72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]
            )
        })
    })

    describe('utf16ToUint16Array', () => {
        it('converts a utf-16 string to an array buffer', () => {
            const arr = utf16ToUint16Array('Hello 😂')
            expectIterableEquals(
                arr,
                [72, 101, 108, 108, 111, 32, 55357, 56834]
            )
        })
    })

    describe('bufferToByteArray', () => {
        describe('when given a Uint8Array', () => {
            it('returns that array', () => {
                const arr = new Uint8Array(1)
                expect(bufferToByteArray(arr)).toBe(arr)
            })
        })

        describe('when given a BufferLike', () => {
            it('returns a new Uint8Array', () => {
                const arr = new Uint16Array(3)
                arr[0] = 0xffee
                arr[1] = 0xddcc
                arr[2] = 0xbbaa
                const bytes: Uint8Array = bufferToByteArray(arr.buffer)
                expect(bytes).not.toBe(arr)
                expectIterableEquals(
                    bytes,
                    [0xee, 0xff, 0xcc, 0xdd, 0xaa, 0xbb]
                )
            })
        })
    })

    describe('bufferToArrayBuffer', () => {
        describe('when given an ArrayBuffer', () => {
            it('returns that buffer', () => {
                const buffer = new ArrayBuffer(4)
                expect(bufferToArrayBuffer(buffer)).toBe(buffer)
            })
        })

        describe('when given a view spanning the whole buffer', () => {
            it('returns a copy of its bytes', () => {
                const view = new Uint8Array([1, 2, 3, 4])
                const buffer = bufferToArrayBuffer(view)
                expectIterableEquals(new Uint8Array(buffer), [1, 2, 3, 4])
            })
        })

        describe('when given an offset view', () => {
            it('returns only the bytes the view spans', () => {
                const view = new Uint8Array([1, 2, 3, 4, 5]).subarray(1, 4)
                const buffer = bufferToArrayBuffer(view)
                expect(buffer.byteLength).toBe(3)
                expectIterableEquals(new Uint8Array(buffer), [2, 3, 4])
            })

            it('honors the element size of wider views', () => {
                const view = new Uint16Array([0x1122, 0x3344, 0x5566]).subarray(
                    1
                )
                const buffer = bufferToArrayBuffer(view)
                expect(buffer.byteLength).toBe(4)
                expectIterableEquals(new Uint16Array(buffer), [0x3344, 0x5566])
            })
        })
    })

    describe('buffersEqual', () => {
        it('returns true when strict equals', () => {
            const arr = [1, 2, 3]
            expect(buffersEqual(arr, arr)).toBeTrue()
            expect(buffersEqual(arr, [])).toBeFalse()
        })

        it('returns true when both are nullish', () => {
            expect(buffersEqual(null, undefined)).toBeTrue()
            expect(buffersEqual(null, null)).toBeTrue()
            expect(buffersEqual(null, [])).toBeFalse()
            expect(buffersEqual([], null)).toBeFalse()
        })

        it('returns true when contents are equal', () => {
            // Note: NaN when used in a buffer becomes 0
            expect(buffersEqual([1, 2, 3], [1, 2, 3])).toBeTrue()
            expect(buffersEqual([1, 2, 3, 4], [1, 2, 3])).toBeFalse()
            expect(buffersEqual([1, 2, 3], [1, 2, 3, 4])).toBeFalse()
            expect(buffersEqual([1, 2, 4], [1, 2, 3])).toBeFalse()
            expect(
                buffersEqual(new Uint8Array([1, 2, 3]), [1, 2, 3])
            ).toBeTrue()
            expect(
                buffersEqual(
                    new Uint8Array([1, 2, 3]),
                    new Uint8Array([1, 2, 3])
                )
            ).toBeTrue()
            expect(
                buffersEqual(
                    new Uint8Array([1, 2, 3]),
                    new Uint8Array([0, 2, 3])
                )
            ).toBeFalse()
            expect(
                buffersEqual(new ArrayBuffer(23), new ArrayBuffer(23))
            ).toBeTrue()
            expect(
                buffersEqual(new ArrayBuffer(23), new ArrayBuffer(24))
            ).toBeFalse()
        })
    })
})
