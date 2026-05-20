/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MockEvent } from '@amazon/vinyl-util/browserTestUtil'

export class MockMSMediaKeyError extends MockEvent implements MSMediaKeyError {
    static readonly MS_MEDIA_KEYERR_CLIENT = 1
    static readonly MS_MEDIA_KEYERR_DOMAIN = 2
    static readonly MS_MEDIA_KEYERR_HARDWARECHANGE = 3
    static readonly MS_MEDIA_KEYERR_OUTPUT = 4
    static readonly MS_MEDIA_KEYERR_SERVICE = 5
    static readonly MS_MEDIA_KEYERR_UNKNOWN = 6

    code: number = 0
    systemCode: number = 0

    constructor() {
        super()
        this.type = 'mskeyerror'
    }
}
