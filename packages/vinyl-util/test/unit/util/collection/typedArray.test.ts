/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { cloneTypedArray, isTypedArray } from '@amazon/vinyl-util'
import { expectIterableEquals } from '@amazon/vinyl-util/browserTestUtil'

describe('isTypedArray', () => {
    it('returns true for typed array buffer views', () => {
        expect(isTypedArray(new Int8Array())).toBeTrue()
        expect(isTypedArray(new Uint8Array())).toBeTrue()
        expect(isTypedArray(new Uint8ClampedArray())).toBeTrue()
        expect(isTypedArray(new Int16Array())).toBeTrue()
        expect(isTypedArray(new Uint16Array())).toBeTrue()
        expect(isTypedArray(new Int32Array())).toBeTrue()
        expect(isTypedArray(new Uint32Array())).toBeTrue()
        expect(isTypedArray(new Float32Array())).toBeTrue()
        expect(isTypedArray(new Float64Array())).toBeTrue()
        expect(isTypedArray([])).toBeFalse()
        expect(isTypedArray({})).toBeFalse()
        expect(isTypedArray(new ArrayBuffer(0))).toBeFalse()
    })
})

describe('cloneTypedArray', () => {
    it('clones a typed array', () => {
        expectIterableEquals(
            cloneTypedArray(new Float32Array([1, 2, 3, 4])),
            new Float32Array([1, 2, 3, 4])
        )
        expectIterableEquals(
            cloneTypedArray(new Float64Array([1, 2, 3, 4])),
            new Float64Array([1, 2, 3, 4])
        )
        expectIterableEquals(
            cloneTypedArray(new Int16Array([1, 2, 3, 4])),
            new Int16Array([1, 2, 3, 4])
        )
        expectIterableEquals(
            cloneTypedArray(new Int32Array([1, 2, 3, 4])),
            new Int32Array([1, 2, 3, 4])
        )
        expectIterableEquals(
            cloneTypedArray(new Int8Array([1, 2, 3, 4])),
            new Int8Array([1, 2, 3, 4])
        )
        expectIterableEquals(
            cloneTypedArray(new Uint16Array([1, 2, 3, 4])),
            new Uint16Array([1, 2, 3, 4])
        )
        expectIterableEquals(
            cloneTypedArray(new Uint32Array([1, 2, 3, 4])),
            new Uint32Array([1, 2, 3, 4])
        )
        expectIterableEquals(
            cloneTypedArray(new Uint8Array([1, 2, 3, 4])),
            new Uint8Array([1, 2, 3, 4])
        )
        expectIterableEquals(
            cloneTypedArray(new Uint8ClampedArray([1, 2, 3, 4])),
            new Uint8ClampedArray([1, 2, 3, 4])
        )

        const source = new Uint8Array([1, 2, 3, 4])
        const cloned = cloneTypedArray(source)
        expect(source).not.toBe(cloned)
    })
})
