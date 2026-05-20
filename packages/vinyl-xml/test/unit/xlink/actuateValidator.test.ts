/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ValidationError } from '@amazon/vinyl-util'
import { assertActuateEnum } from '@amazon/vinyl-xml'

describe('xlink', () => {
    describe('assertActuateEnum', () => {
        it('produces a valid value for the actuate enum', () => {
            expect(assertActuateEnum('onLoad')).toBe('onLoad')
            expect(assertActuateEnum('onRequest')).toBe('onRequest')
        })
        it(`throws an assertion error if the actuate value doesn't match expectations`, () => {
            expect(() => assertActuateEnum('unknown')).toThrowMatching(
                (e) => e instanceof ValidationError
            )
        })
    })
})
