/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    AutoResetController,
    AutoResetControllerEventMap,
} from '@amazon/vinyl'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import { MockEventHost } from '@amazon/vinyl-util/testUtil'

const spyFactory = createSpyFactory<AutoResetController>()
export class MockAutoResetController
    extends MockEventHost<AutoResetControllerEventMap>
    implements AutoResetController
{
    setError = spyFactory('setError')
    clear = spyFactory('clear')
    resetPending = false
}
