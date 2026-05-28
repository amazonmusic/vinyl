/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Maybe } from '../type'

/**
 * Converts a byte buffer to an 8-bit width string.
 *
 * @return Returns a single-byte string.
 * @param buffer
 */
export function bufferToByteStr(
    buffer: ArrayLike<number> | ArrayBuffer
): string {
    return String.fromCharCode.apply(
        null,
        new Uint8Array(buffer) as unknown as number[]
    )
}

/**
 * Converts a byte string to a byte array.
 *
 * @param byteStr The 8 bit-width string to convert to a byte array.
 * @return Returns a byte array representing the byte string.
 */
export function byteStrToByteArray(byteStr: string): Uint8Array<ArrayBuffer> {
    // This does the same thing as {@link TextEncoder.encode}, but TextEncoder is not available on
    // Edge Legacy, which we require for PlayReady testing.
    const n = byteStr.length
    const bytes = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
        bytes[i] = byteStr.charCodeAt(i)
    }
    return bytes
}

/**
 * Converts an array buffer of binary data to a Base64 encoded string.
 *
 * @param buffer a buffer of binary data.
 * @return Returns a Base64 encoded string representing the provided binary data.
 */
export function bufferToBase64(
    buffer: ArrayLike<number> | ArrayBuffer
): string {
    return global.btoa(bufferToByteStr(buffer))
}

/**
 * Converts a Base64 encoded string into a byte array.
 * The 6-bit width Base64 data is converted to a binary string then written to a byte array.
 *
 * @param base64 A Base64 encoded string.
 */
export function base64ToByteArray(base64: string): Uint8Array<ArrayBuffer> {
    return byteStrToByteArray(global.atob(base64))
}

/**
 * Converts a 16-bit buffer of any length to a utf-16 string.
 *
 * @see https://developer.chrome.com/blog/how-to-convert-arraybuffer-to-and-from-string
 *
 * @param buffer An iterable of double-byte code points.
 * @return Returns a UTF-16 string.
 */
export function bufferToUtf16(buffer: ArrayLike<number> | ArrayBuffer): string {
    return String.fromCharCode.apply(
        null,
        new Uint16Array(buffer) as unknown as number[]
    )
}

/**
 * Converts a UTF-16 string to a Uint16Array.
 *
 * @see https://developer.chrome.com/blog/how-to-convert-arraybuffer-to-and-from-string
 * @param str A UTF-16 string.
 */
export function utf16ToUint16Array(str: string): Uint16Array<ArrayBuffer> {
    const n = str.length
    const uint16Array = new Uint16Array(n)
    for (let i = 0; i < n; i++) {
        uint16Array[i] = str.charCodeAt(i)
    }
    return uint16Array
}

/**
 * If a byte array is provided, returns as is, otherwise creates a Uint8Array from an array buffer like.
 * @param buffer
 */
export function bufferToByteArray(
    buffer: Uint8Array<ArrayBuffer> | ArrayLike<number> | ArrayBuffer
): Uint8Array<ArrayBuffer> {
    return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
}

/**
 * Returns true if the two buffers are equal.
 */
export function buffersEqual(
    bufferA: Maybe<Uint8Array | ArrayLike<number> | ArrayBuffer>,
    bufferB: Maybe<Uint8Array | ArrayLike<number> | ArrayBuffer>
): boolean {
    if (bufferA === bufferB) return true
    if (!bufferA && !bufferB) return true
    if (!bufferA || !bufferB) return false

    const arrA = bufferToByteArray(bufferA)
    const arrB = bufferToByteArray(bufferB)

    if (arrA.byteLength !== arrB.byteLength) return false
    for (let i = 0; i < arrA.byteLength; i++) {
        if (arrA[i] !== arrB[i]) return false
    }
    return true
}
