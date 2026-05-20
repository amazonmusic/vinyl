/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { stringifyForPrint } from '@amazon/vinyl-util'

describe('stringifyForPrint', () => {
    it('preserves NaN, Infinity, undefined, function, and symbol', () => {
        expect(stringifyForPrint('test')).toBe('"test"')
        expect(stringifyForPrint(3)).toBe('3')
        expect(stringifyForPrint(NaN)).toBe('NaN')
        expect(stringifyForPrint({ value: NaN })).toBe('{\n  "value": NaN\n}')
        expect(stringifyForPrint({ value: undefined })).toBe(
            '{\n  "value": undefined\n}'
        )
        expect(stringifyForPrint(undefined)).toBe('undefined')
        expect(stringifyForPrint(Symbol.for('key'))).toBe('"[symbol key]"')
        expect(stringifyForPrint(Number.POSITIVE_INFINITY)).toBe('Infinity')
        expect(stringifyForPrint(Number.NEGATIVE_INFINITY)).toBe('-Infinity')
        const v = {
            a: {
                b: undefined,
                c: NaN,
                d: () => {},
                e: 'e',
            },
        }
        expect(stringifyForPrint(v)).toBe(`{
  "a": {
    "b": undefined,
    "c": NaN,
    "d": "[function d]",
    "e": "e"
  }
}`)
    })

    describe('when a maxLength is provided', () => {
        it('truncates the output', () => {
            expect(stringifyForPrint('this is too long', 5, '…')).toEqual(
                '"thi…'
            )
        })
    })
})
