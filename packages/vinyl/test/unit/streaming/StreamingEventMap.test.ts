/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { expectTypeStrictlyEquals } from '@amazon/vinyl-util/browserTestUtil'
import type { ALL_STREAMING_EVENTS, StreamingEventMap } from '@amazon/vinyl'

describe('ALL_STREAMING_EVENTS', () => {
    it('provides a comprehensive list of all streaming events', () => {
        expectTypeStrictlyEquals<
            keyof StreamingEventMap,
            (typeof ALL_STREAMING_EVENTS)[number]
        >(true)
    })
})
