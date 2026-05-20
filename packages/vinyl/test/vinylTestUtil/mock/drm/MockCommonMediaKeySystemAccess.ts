/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DrmKeySystem } from '@amazon/vinyl'
import { type CommonMediaKeySystemAccess } from '@amazon/vinyl'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'

const spyFactory = createSpyFactory<CommonMediaKeySystemAccess>()

export class MockCommonMediaKeySystemAccess
    implements CommonMediaKeySystemAccess
{
    constructor(public keySystem: DrmKeySystem) {}

    createMediaKeys = spyFactory('createMediaKeys')
}
