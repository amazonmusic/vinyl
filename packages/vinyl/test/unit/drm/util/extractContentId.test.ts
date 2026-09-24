/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { extractContentId } from '@amazon/vinyl'

import { utf16ToUint16Array, ValidationError } from '@amazon/vinyl-util'

describe('extractContentId', () => {
    function createContentIdByteArray(str: string): Uint8Array<ArrayBuffer> {
        const uint16Array = utf16ToUint16Array(str)
        return new Uint8Array(uint16Array.buffer)
    }

    describe('with match', () => {
        it('matches', () => {
            expect(
                extractContentId(createContentIdByteArray('skd://example0'))
            ).toBe('example0')
        })
    })

    describe('with an offset view', () => {
        it('reads only the bytes the view spans', () => {
            const padded = createContentIdByteArray('\0\0skd://example0\0\0')
            const view = padded.subarray(4, padded.byteLength - 4)
            expect(extractContentId(view)).toBe('example0')
        })
    })

    describe('without match', () => {
        it('throws ValidationError', () => {
            expect(() => {
                extractContentId(new Uint8Array())
            }).toThrowError(ValidationError, 'No contentId match')
            expect(() => {
                expect(
                    extractContentId(createContentIdByteArray('skd://'))
                ).toBe('example0')
            }).toThrowError(ValidationError, 'No contentId match')
        })
    })
})
