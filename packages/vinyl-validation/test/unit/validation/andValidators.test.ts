/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Validator } from '@amazon/vinyl-validation'
import {
    andValidators,
    createValidator,
    isOneOf,
} from '@amazon/vinyl-validation'
import { MockValidator } from './MockValidator'

describe('andValidators', () => {
    it('validates two validators pass', () => {
        const v: Validator<2 | 3> = andValidators(
            isOneOf(1, 2, 3),
            isOneOf(2, 3, 4)
        )
        expect(v.isValid(1)).toBeFalse()
        expect(v.isValid(2)).toBeTrue()
        expect(v.isValid(3)).toBeTrue()
        expect(v.isValid(4)).toBeFalse()
        expect(v.isValid(5)).toBeFalse()
    })

    it('validates three validators pass', () => {
        const v: Validator<3> = andValidators(
            isOneOf(1, 2, 3),
            isOneOf(2, 3, 4),
            isOneOf(3, 4, 5)
        )
        expect(v.isValid(1)).toBeFalse()
        expect(v.isValid(2)).toBeFalse()
        expect(v.isValid(3)).toBeTrue()
        expect(v.isValid(4)).toBeFalse()
        expect(v.isValid(5)).toBeFalse()
        expect(v.isValid(6)).toBeFalse()
    })

    it('validates six validators pass', () => {
        const v: Validator<2> = andValidators(
            isOneOf(2, 1),
            isOneOf(2, 2),
            isOneOf(2, 3),
            isOneOf(2, 4),
            isOneOf(2, 5),
            isOneOf(2, 6)
        )
        expect(v.isValid(1)).toBeFalse()
        expect(v.isValid(2)).toBeTrue()
        expect(v.isValid(3)).toBeFalse()
        expect(v.isValid(4)).toBeFalse()
        expect(v.isValid(5)).toBeFalse()
        expect(v.isValid(6)).toBeFalse()
    })

    it('provides validate options and path to all validators', () => {
        const a = new MockValidator()
        const b = new MockValidator()
        a.validate.and.returnValue([])
        b.validate.and.returnValue([])
        const v = andValidators(a, b)
        const options = { all: true }
        const path = ['a', 'b']
        v.validate(3, options, path)
        expect(a.validate).toHaveBeenCalledOnceWith(3, options, path)
        expect(b.validate).toHaveBeenCalledOnceWith(3, options, path)
    })

    describe('description', () => {
        it('joins child validator descriptions', () => {
            expect(
                andValidators(
                    createValidator('a', (_) => true),
                    createValidator('b', (_) => true),
                    createValidator('c', (_) => true)
                ).description
            ).toEqual('a & b & c')
        })
    })
})
