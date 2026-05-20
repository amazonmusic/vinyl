/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    ALL_PLAYBACK_STATE_EVENTS,
    PlaybackControllerEventMap,
} from '@amazon/vinyl'
import { expectTypeStrictlyEquals } from '@amazon/vinyl-util/browserTestUtil'

describe('ALL_PLAYBACK_STATE_EVENTS', () => {
    it('provides a comprehensive list of all playback state events', () => {
        expectTypeStrictlyEquals<
            keyof PlaybackControllerEventMap,
            (typeof ALL_PLAYBACK_STATE_EVENTS)[number]
        >(true)
    })
})
