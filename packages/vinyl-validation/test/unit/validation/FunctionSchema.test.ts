/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Fun, Maybe } from '@amazon/vinyl-util'
import type { FunctionSchema, Validator } from '@amazon/vinyl-validation'
import { func } from '@amazon/vinyl-validation'
import { expectTypeStrictlyEquals } from '@amazon/vinyl-util/browserTestUtil'

describe('FunctionSchema', () => {
    describe('base', () => {
        it('asserts that the input is a nullish function', () => {
            const v: FunctionSchema<Fun> = func()
            expect(v.isValid(null)).toBeFalse()
            v.assert(() => {})
            function foo() {}
            v.assert(foo)
            expect(v.validate({})).toEqual([
                {
                    message: 'Expected: type function, but was: {}. At: ',
                    path: [],
                },
            ])
        })
    })

    describe('length', () => {
        it('asserts the function accepts at most n parameters', () => {
            const v: Validator<Fun> = func().length(3)
            expect(v.isValid(null)).toBeFalse()
            v.assert((..._: any[]) => {})
            v.assert((_: 1, _1: 2, _2: 3) => {})
            v.assert((_: 1, _1: 2) => {})

            expect(v.validate((_: 1, _1: 2, _2: 3, _3: 4) => {})).toEqual([
                {
                    message:
                        'Expected: at most 3 arguments, but was: 4 arguments. At: ',
                    path: [],
                },
            ])
        })

        it('is chainable', () => {
            const v: Validator<Maybe<Fun>> = func().length(2).maybe()
            expect(v.isValid(null)).toBeTrue()
            expect(v.isValid((_: 1, _1: 2, _2: 3) => {})).toBeFalse()
        })
    })

    describe('cast', () => {
        it('casts the type parameter', () => {
            const _validator =
                func().cast<(arg1: 1, arg2: 2, arg3: 3) => boolean>()
            expectTypeStrictlyEquals<
                typeof _validator,
                FunctionSchema<(a: 1, b: 2, c: 3) => boolean>
            >(true)
        })
    })
})
