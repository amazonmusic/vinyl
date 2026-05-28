/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NetworkState, NetworkStateEventMap } from '@amazon/vinyl-util'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import { MockEventHost } from '../event/MockEventHost'

const spyFactory = createSpyFactory<NetworkState>()
export class MockNetworkState
    extends MockEventHost<NetworkStateEventMap>
    implements NetworkState
{
    onLine = false

    nextOnLine = spyFactory('nextOnLine')
}
