/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { expectTypeStrictlyEquals } from '@amazon/vinyl-util/browserTestUtil'
import type { ALL_TEXT_TRACK_EVENTS, TextTrackEventMap } from '@amazon/vinyl'

describe('ALL_TEXT_TRACK_EVENTS', () => {
    it('provides a comprehensive list of all text track events', () => {
        // The player redispatches exactly these; an omission silently stops an
        // event reaching consumers, and `satisfies` alone does not catch it.
        expectTypeStrictlyEquals<
            keyof TextTrackEventMap,
            (typeof ALL_TEXT_TRACK_EVENTS)[number]
        >(true)
    })
})
