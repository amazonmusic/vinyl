/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Array views of a data buffer.
 */
export type TypedArray =
    | Float32Array
    | Float64Array
    | Int16Array
    | Int32Array
    | Int8Array
    | Uint16Array
    | Uint32Array
    | Uint8Array
    | Uint8ClampedArray

/**
 * Creates a new typed array with identical contents as the source.
 *
 * @param array
 */
export function cloneTypedArray<T extends TypedArray>(array: T): T {
    // typed array slice() is not supported on Comcast OTT device.
    return new (array.constructor as new (array: T) => T)(array)
}

const typedArrayTypes = [
    Float32Array,
    Float64Array,
    Int16Array,
    Int32Array,
    Int8Array,
    Uint16Array,
    Uint32Array,
    Uint8Array,
    Uint8ClampedArray,
]

/**
 * Returns true if the given value is an instance of one of the typed array types.
 *
 * @param value
 */
export function isTypedArray(value: any): value is TypedArray {
    return typedArrayTypes.some((type) => value instanceof type)
}
