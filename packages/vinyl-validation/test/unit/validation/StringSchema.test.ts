/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { StringSchema } from '@amazon/vinyl-validation'
import { string } from '@amazon/vinyl-validation'

describe('StringSchema', () => {
    describe('minLength', () => {
        it('throws if a string has less than the validator length', () => {
            const v: StringSchema = string().minLength(5)

            expect(v.validate('')).toEqual([
                {
                    message:
                        'Expected: at least 5 characters, but was: "". At: ',
                    path: [],
                },
            ])
            expect(v.validate('1234')).toEqual([
                {
                    message:
                        'Expected: at least 5 characters, but was: "1234". At: ',
                    path: [],
                },
            ])
            v.assert('123456')
            expect(v.isValid(null)).toBeFalse()
        })
    })

    describe('maxLength', () => {
        it('throws if a string has more than the validator length', () => {
            const v: StringSchema = string().maxLength(5)

            expect(v.validate('123456')).toEqual([
                {
                    message:
                        'Expected: at most 5 characters, but was: "123456". At: ',
                    path: [],
                },
            ])
            expect(v.validate('a longer string')).toEqual([
                {
                    message:
                        'Expected: at most 5 characters, but was: "a longer string". At: ',
                    path: [],
                },
            ])
            expect(v.isValid(undefined)).toBeFalse()
            v.assert('12345')
            v.assert('1234')
            v.assert('')
        })
    })

    describe('notEmpty', () => {
        it('throws if the string is empty', () => {
            const v: StringSchema = string().notEmpty()

            expect(v.validate('')).toEqual([
                { message: 'Expected: not empty, but was: "". At: ', path: [] },
            ])

            v.assert('a')
            v.assert(' ')

            expect(string().notEmpty().isValid(null)).toBeFalse()
        })
    })

    describe('noWhitespace', () => {
        it('fails if there is whitespace', () => {
            const v: StringSchema = string().noWhitespace()
            expect(v.isValid('This is a test')).toBeFalse()
            expect(v.isValid('\tThis_is_a_test')).toBeFalse()
            expect(v.isValid('This_is\na_test')).toBeFalse()
            expect(v.isValid(null)).toBeFalse()
            expect(v.isValid('anExampleWithNoWhitespace')).toBeTrue()
        })
    })

    describe('matches', () => {
        it('validates that a string matches a regex', () => {
            const v: StringSchema = string().matches(/@\w{3,16}/)
            expect(v.isValid('')).toBeFalse()
            expect(v.isValid('@a')).toBeFalse()
            expect(v.isValid('@akligman')).toBeTrue()
        })
    })
})
