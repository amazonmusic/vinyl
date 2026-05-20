/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RecordSchema, Validator } from '@amazon/vinyl-validation'
import {
    createValidator,
    isOneOf,
    number,
    record,
    recordValues,
} from '@amazon/vinyl-validation'
import { expectTypeStrictlyEquals } from '@amazon/vinyl-util/browserTestUtil'
import type { ReadonlyRecord } from '@amazon/vinyl-util'

describe('RecordSchema', () => {
    describe('record', () => {
        it('validates that all keys and values match their respective validators', () => {
            const v: Validator<ReadonlyRecord<'a' | 'b', number>> = record(
                isOneOf('a', 'b'),
                number()
            )
            expect(v.isValid({})).toBeTrue()
            expect(v.isValid(null)).toBeFalse()
            expect(
                v.isValid({
                    a: 1,
                    b: 2,
                })
            ).toBeTrue()
            expect(
                v.validate({
                    a: 1,
                    c: 2,
                })
            ).toEqual([
                {
                    message: 'Expected: one of: a | b, but was: "c". At: [c]',
                    path: ['[c]'],
                },
            ])

            expect(
                v.validate({
                    a: 1,
                    b: 'test',
                })
            ).toEqual([
                {
                    message: 'Expected: type number, but was: "test". At: b',
                    path: ['b'],
                },
            ])
        })

        it('creates a human-readable description', () => {
            // { [key: string]: 1 | 2 }
            expect(
                record(
                    createValidator<string>('string', (_) => true),
                    createValidator<1 | 2>('1 | 2', () => true)
                ).description
            ).toEqual('type object & { [key: string]: 1 | 2 }')
        })
    })

    describe('recordValues', () => {
        it('validates that all keys are strings and all values pass the given validator', () => {
            const v: Validator<ReadonlyRecord<string, number>> =
                recordValues(number())
            expect(v.isValid({})).toBeTrue()
            expect(v.isValid(null)).toBeFalse()
            v.validate({
                a: 1,
                b: 2,
            })
            const a = Symbol('a')
            expect(
                v.validate({
                    [a]: 1,
                    c: 2,
                })
            ).toEqual([
                {
                    message:
                        'Expected: type string, but was: "[symbol a]". At: [Symbol(a)]',
                    path: ['[Symbol(a)]'],
                },
            ])

            expect(
                v.validate({
                    a: 1,
                    b: 'test',
                })
            ).toEqual([
                {
                    message: 'Expected: type number, but was: "test". At: b',
                    path: ['b'],
                },
            ])
        })
    })

    describe('readonly', () => {
        it('casts the type parameter as a ReadonlyRecord', () => {
            const _v = recordValues(number()).readonly()
            expectTypeStrictlyEquals<
                typeof _v,
                RecordSchema<ReadonlyRecord<string, number>>
            >(true)
        })
    })

    describe('cast', () => {
        it('casts the type parameter', () => {
            const _v = recordValues(number()).cast<Record<string, string>>()
            expectTypeStrictlyEquals<
                typeof _v,
                RecordSchema<Record<string, string>>
            >(true)
        })
    })
})
