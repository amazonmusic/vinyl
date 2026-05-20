/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DrmInitDataType } from '@amazon/vinyl'
import {
    type CommonMediaKeySession,
    type CommonMediaKeySessionEventMap,
    type EncryptedInitData,
} from '@amazon/vinyl'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import { MockEventHost } from '@amazon/vinyl-util/testUtil'

const spyFactory = createSpyFactory<CommonMediaKeySession>()
export class MockCommonMediaKeySession
    extends MockEventHost<CommonMediaKeySessionEventMap>
    implements CommonMediaKeySession
{
    initData: EncryptedInitData = new ArrayBuffer(0)
    initDataType: DrmInitDataType = 'cenc'
    mimeType = ''
    disposed = false

    update = spyFactory('update')
}
