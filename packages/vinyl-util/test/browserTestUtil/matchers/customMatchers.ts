/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WithToBeCloseToWithinMatcher } from './toBeCloseToWithin'
import { addToBeCloseToWithin } from './toBeCloseToWithin'

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace jasmine {
        // eslint-disable-next-line
        interface Matchers<T> extends WithToBeCloseToWithinMatcher {}
    }
}

export function addCustomMatchers() {
    addToBeCloseToWithin()
}
