/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import CustomMatcher = jasmine.CustomMatcher

export interface WithToBeCloseToWithinMatcher {
    toBeCloseToWithin(expected: number, tolerance?: number): boolean
}

export function addToBeCloseToWithin() {
    beforeEach(function () {
        jasmine.addMatchers({
            toBeCloseToWithin: function (): CustomMatcher {
                return {
                    compare: function (
                        actual: number,
                        expected: number,
                        tolerance: number = Number.EPSILON
                    ) {
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                        if (tolerance == null) {
                            throw new Error('You must supply a tolerance value')
                        }

                        const pass = Math.abs(expected - actual) <= tolerance
                        const message = pass
                            ? `Expected ${actual} to be close to ${expected} with tolerance ${tolerance}`
                            : `Expected ${actual} to be close to ${expected} with tolerance ${tolerance}, but it was not`

                        return { pass: pass, message: message }
                    },
                }
            },
        })
    })
}
