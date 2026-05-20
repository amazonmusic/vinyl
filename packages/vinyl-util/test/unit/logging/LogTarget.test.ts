/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createLogPrefix } from '@amazon/vinyl-util'

class WithToStringTagTest {
    get [Symbol.toStringTag](): string {
        return 'WithToStringTagTest'
    }
}

describe('createLogPrefix', () => {
    it('starts with the given name', () => {
        expect(createLogPrefix('bar')).toContain('bar/')
    })

    it('provides a unique name', () => {
        expect(createLogPrefix('bar')).not.toEqual(createLogPrefix('bar'))
    })

    it('accepts objects with a toStringTag getter', () => {
        expect(createLogPrefix(new WithToStringTagTest())).toContain(
            'WithToStringTagTest/'
        )
    })
})
