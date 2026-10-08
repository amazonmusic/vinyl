/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { drmOptionsValidator } from '@amazon/vinyl'

describe('drmOptionsValidator', () => {
    describe('preferPrefixedMediaKeys', () => {
        for (const value of [true, false, null, undefined]) {
            it(`accepts ${String(value)}`, () => {
                expect(
                    drmOptionsValidator.validate({
                        keySystems: {},
                        preferPrefixedMediaKeys: value,
                    })
                ).toEqual([])
            })
        }

        it('rejects a non-boolean', () => {
            expect(
                drmOptionsValidator.validate({
                    keySystems: {},
                    preferPrefixedMediaKeys: 'true',
                })
            ).not.toEqual([])
        })
    })
})
