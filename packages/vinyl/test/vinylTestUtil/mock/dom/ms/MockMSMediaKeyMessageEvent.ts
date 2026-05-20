/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MSMediaKeyMessageEvent } from '@amazon/vinyl'
import { MockEvent } from '@amazon/vinyl-util/browserTestUtil'

export class MockMSMediaKeyMessageEvent
    extends MockEvent
    implements MSMediaKeyMessageEvent
{
    message = new Uint8Array(0)

    constructor() {
        super()
        this.type = 'mskeymessage'
    }
}
