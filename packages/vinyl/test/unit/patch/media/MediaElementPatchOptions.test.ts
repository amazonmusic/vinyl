/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    defaultMediaElementPatchOptions,
    type MediaElementPatchOptions,
} from '@amazon/vinyl'
import any = jasmine.any
import objectContaining = jasmine.objectContaining

describe('defaultMediaElementPatchOptions', () => {
    afterEach(() => {
        defaultMediaElementPatchOptions.clear()
    })

    it('provides a value with the default patch flags', () => {
        expect(defaultMediaElementPatchOptions.value).toEqual(
            objectContaining<Required<MediaElementPatchOptions>>({
                unreliablePlaybackEvents: any(Boolean),
            })
        )
    })
})
