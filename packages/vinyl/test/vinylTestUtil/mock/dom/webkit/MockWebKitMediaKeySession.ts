/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    MockEventTarget,
    createSpyFactory,
} from '@amazon/vinyl-util/browserTestUtil'

const spyFactory = createSpyFactory<WebKitMediaKeySession>()
export class MockWebKitMediaKeySession
    extends MockEventTarget
    implements WebKitMediaKeySession
{
    error: WebKitMediaKeyError | null = null
    keySystem = ''
    onwebkitkeyadded = null
    onwebkitkeyerror = null
    onwebkitkeymessage = null
    sessionId = ''

    close = spyFactory('close')

    update = spyFactory('update')

    addEventListener = spyFactory('addEventListener')

    dispatchEvent = spyFactory('dispatchEvent')

    removeEventListener = spyFactory('removeEventListener')
}
