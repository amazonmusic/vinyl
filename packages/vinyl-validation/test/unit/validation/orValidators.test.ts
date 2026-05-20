/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Validator } from '@amazon/vinyl-validation'
import {
    createValidator,
    number,
    object,
    orValidators,
} from '@amazon/vinyl-validation'
import { expectTypeStrictlyEquals } from '@amazon/vinyl-util/browserTestUtil'

describe('orValidators', () => {
    it('returns a validator that validates the input matches one of the validators', () => {
        const v: Validator<1 | 2> = orValidators(
            createValidator<1>('1', (input) => input === 1),
            createValidator<2>('2', (input) => input === 2)
        )
        expect(v.isValid(1)).toBeTrue()
        expect(v.isValid(2)).toBeTrue()
        expect(v.isValid(3)).toBeFalse()
        expect(v.validate(3)).toEqual([
            {
                message: 'Expected: (1 | 2), but was: 3. At: ',
                path: [],
            },
        ])
    })

    it('unions an arbitrary number of validators', () => {
        const v = orValidators(
            createValidator<1>('1', (input) => input === 1),
            createValidator<2>('2', (input) => input === 2),
            createValidator<3>('3', (input) => input === 3),
            createValidator<4>('4', (input) => input === 4)
        )
        expectTypeStrictlyEquals<typeof v, Validator<1 | 2 | 3 | 4, any>>(true)
        expect(v.isValid(1)).toBeTrue()
        expect(v.isValid(2)).toBeTrue()
        expect(v.isValid(3)).toBeTrue()
        expect(v.isValid(4)).toBeTrue()
        expect(v.isValid(5)).toBeFalse()

        expect(v.validate(5)).toEqual([
            {
                message: 'Expected: (1 | 2 | 3 | 4), but was: 5. At: ',
                path: [],
            },
        ])
    })

    describe('description', () => {
        it('joins child validator descriptions', () => {
            expect(
                orValidators(
                    createValidator('a', (_) => true),
                    createValidator('b', (_) => true),
                    createValidator('c', (_) => true)
                ).description
            ).toEqual('(a | b | c)')
        })
    })

    describe('when one of the validators fails at a deeper path', () => {
        it('uses the error message from that validator', () => {
            expect(
                orValidators<number, { childProp: number }>(
                    number(),
                    object({ childProp: number() })
                ).validate(
                    {
                        childProp: 'not-a-number',
                    },
                    {},
                    ['pathA']
                )
            ).toEqual([
                {
                    message:
                        'Expected: type number, but was: "not-a-number". At: pathA.childProp',
                    path: ['pathA', 'childProp'],
                },
            ])
        })
    })
})
