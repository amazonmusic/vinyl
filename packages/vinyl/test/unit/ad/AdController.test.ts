/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { expectTypeStrictlyEquals } from '@amazon/vinyl-util/browserTestUtil'
import type { ALL_AD_EVENTS, AdEventMap } from '../../../src'

describe('ALL_AD_EVENTS', () => {
    it('provides a comprehensive list of all ad controller state events', () => {
        expectTypeStrictlyEquals<
            keyof AdEventMap,
            (typeof ALL_AD_EVENTS)[number]
        >(true)
    })
})
