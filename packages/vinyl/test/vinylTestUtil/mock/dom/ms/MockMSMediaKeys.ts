/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DrmKeySystem } from '@amazon/vinyl'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'

const spyFactory = createSpyFactory<typeof MSMediaKeys & MSMediaKeys>()

export class MockMSMediaKeys implements MSMediaKeys {
    constructor(readonly keySystem: DrmKeySystem) {}

    createSession = spyFactory('createSession')

    static isTypeSupported = spyFactory('isTypeSupported')
}
