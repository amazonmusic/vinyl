/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommonEme } from '@amazon/vinyl'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'

const spyFactory = createSpyFactory<CommonEme>()

export class MockCommonEme implements CommonEme {
    requestMediaKeySystemAccess = spyFactory('requestMediaKeySystemAccess')

    addEncryptedListener = spyFactory('addEncryptedListener')
}
