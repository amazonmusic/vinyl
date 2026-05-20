/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createSpyFactory,
    MockEventTarget,
} from '@amazon/vinyl-util/browserTestUtil'

const spyFactory = createSpyFactory<MSMediaKeySession>()
export class MockMSMediaKeySession
    extends MockEventTarget
    implements MSMediaKeySession
{
    error: MSMediaKeyError | null = null
    keySystem = ''
    onmskeyadded = null
    onmskeyerror = null
    onmskeymessage = null
    sessionId = ''

    close = spyFactory('close')

    update = spyFactory('update')

    addEventListener = spyFactory('addEventListener')

    dispatchEvent = spyFactory('dispatchEvent')

    removeEventListener = spyFactory('removeEventListener')
}
