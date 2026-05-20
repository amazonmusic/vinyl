/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { isNode, type Version } from '@amazon/vinyl-util'
import { vinylVersion } from '@amazon/vinyl'
import objectContaining = jasmine.objectContaining
import any = jasmine.any

describe('vinylVersion', () => {
    beforeEach(() => {
        if (isNode()) pending('Requires browser environment')
    })

    it('parses correctly', () => {
        expect(vinylVersion).toEqual(
            objectContaining<Version>({
                major: any(Number),
                minor: any(Number),
            })
        )
    })
})
