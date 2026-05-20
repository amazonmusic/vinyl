/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DrmController, DrmControllerEventMap } from '@amazon/vinyl'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import { MockEventHost } from '@amazon/vinyl-util/testUtil'

const spyFactory = createSpyFactory<DrmController>()
export class MockDrmController
    extends MockEventHost<DrmControllerEventMap>
    implements DrmController
{
    error: Error | null = null

    configure = spyFactory('configure')
    isEmeSupported = spyFactory('isEmeSupported')
    isSupported = spyFactory('isSupported')
    initializeForPlayback = spyFactory('initializeForPlayback')
    setBufferingDrmInfo = spyFactory('setBufferingDrmInfo')
    closeSessions = spyFactory('closeSessions')
    reset = spyFactory('reset')
}
