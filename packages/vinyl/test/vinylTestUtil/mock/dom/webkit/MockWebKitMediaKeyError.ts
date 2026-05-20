/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MockEvent } from '@amazon/vinyl-util/browserTestUtil'

export class MockWebKitMediaKeyError
    extends MockEvent
    implements WebKitMediaKeyError
{
    static readonly MEDIA_KEYERR_UNKNOWN = 1
    static readonly MEDIA_KEYERR_CLIENT = 2
    static readonly MEDIA_KEYERR_SERVICE = 3
    static readonly MEDIA_KEYERR_OUTPUT = 4
    static readonly MEDIA_KEYERR_HARDWARECHANGE = 5
    static readonly MEDIA_KEYERR_DOMAIN = 6
    code: number = 0
    systemCode: number = 0

    constructor() {
        super()
        this.type = 'webkitkeyerror'
    }
}
