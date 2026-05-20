/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createVinylTrackFactories } from '@amazon/vinyl'
import { createMockVinylDependencies } from '@amazon/vinyl/vinylTestUtil'
import objectContaining = jasmine.objectContaining
import any = jasmine.any

describe('createVinylTrackFactories', () => {
    it('returns track factories for Vinyl', () => {
        const trackFactories = createVinylTrackFactories(
            createMockVinylDependencies()
        )
        expect(trackFactories).toEqual(
            objectContaining({
                src: any(Object),
                srcObject: any(Object),
            })
        )
    })
})
