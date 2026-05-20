/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MockNavigator } from '@amazon/vinyl-util/browserTestUtil'
import { spyOnPropertySafe } from '@/mock/util/spyOnPropertySafe'

/**
 * Sets the global navigator to a Mock
 * Returns the new MockNavigator instance.
 */
export function setMockNavigator(): MockNavigator {
    const navigator = new MockNavigator()
    spyOnPropertySafe(global, 'navigator').and.returnValue(navigator)
    return navigator
}
