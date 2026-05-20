/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Clearable, isClearable, maybeClear } from '@amazon/vinyl-util'
import { expectTypeExtends } from '@amazon/vinyl-util/browserTestUtil'
import createSpy = jasmine.createSpy

describe('clearable', () => {
    describe('isClearable', () => {
        it('returns true when an input has a no-parameter clear method', () => {
            expect(isClearable({})).toBeFalse()
            expect(isClearable(null)).toBeFalse()
            expect(isClearable({ clear() {} })).toBeTrue()
            expect(isClearable({ clear(_: number) {} })).toBeFalse()
        })

        it('narrows type when true', () => {
            const clearable: unknown = {
                clear() {},
            }
            expectTypeExtends<typeof clearable, Clearable>(false)
            if (isClearable(clearable)) {
                expectTypeExtends<typeof clearable, Clearable>(true)
            }
        })
    })

    describe('maybeClear', () => {
        it('clears when clearable', () => {
            const clearable = {
                clear: createSpy('clear'),
            }
            maybeClear(clearable)
            expect(clearable.clear).toHaveBeenCalledOnceWith()
            maybeClear(null)
            maybeClear({})
        })
    })
})
