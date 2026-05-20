/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type CommonMediaKeys, DrmKeySystem } from '@amazon/vinyl'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'

const spyFactory = createSpyFactory<CommonMediaKeys>()
export class MockCommonMediaKeys implements CommonMediaKeys {
    keySystem: DrmKeySystem = DrmKeySystem.CLEAR_KEY
    clearFromElement = spyFactory('clearFromElement')
    createSession = spyFactory('createSession')
    setOnElement = spyFactory('setOnElement')
    setServerCertificate = spyFactory('setServerCertificate')
}
