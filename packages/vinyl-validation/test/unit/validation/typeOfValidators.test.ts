/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { typeOfValidators } from '@amazon/vinyl-validation'
import objectContaining = jasmine.objectContaining

const { boolean, func, number, object, string, symbol } = typeOfValidators

describe('typeOfValidators', () => {
    it('validates that the input matches the expected type', () => {
        expect(boolean.isValid(true)).toBeTrue()
        expect(boolean.isValid(null)).toBeFalse()
        expect(boolean.validate(-1)).toEqual([
            {
                message: 'Expected: type boolean, but was: -1. At: ',
                path: [],
            },
        ])
        expect(func.isValid(() => {})).toBeTrue()
        expect(func.isValid(undefined)).toBeFalse()
        expect(func.isValid(null)).toBeFalse()
        expect(number.isValid(3)).toBeTrue()
        expect(number.isValid('test')).toBeFalse()
        expect(object.isValid({})).toBeTrue()
        expect(object.validate('test')).toEqual([
            {
                message: 'Expected: type object, but was: "test". At: ',
                path: [],
            },
        ])
        expect(string.isValid('test')).toBeTrue()
        expect(string.validate(3)).toEqual([
            {
                message: 'Expected: type string, but was: 3. At: ',
                path: [],
            },
        ])
        expect(symbol.isValid(Symbol())).toBeTrue()
        expect(symbol.validate(NaN)).toEqual([
            {
                message: 'Expected: type symbol, but was: NaN. At: ',
                path: [],
            },
        ])
    })

    describe('validate', () => {
        it('has an expectation message using the expected type', () => {
            expect(func.validate(-1)).toEqual([
                objectContaining({
                    message: 'Expected: type function, but was: -1. At: ',
                    path: [],
                }),
            ])
            expect(string.validate(-1)).toEqual([
                objectContaining({
                    message: 'Expected: type string, but was: -1. At: ',
                    path: [],
                }),
            ])
        })
    })
})
