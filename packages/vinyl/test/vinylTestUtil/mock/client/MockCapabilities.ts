/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Capabilities } from '@amazon/vinyl'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'

const spyFactory = createSpyFactory<Capabilities>()
export class MockCapabilities implements Capabilities {
    sampleRate: number | null = null
    dash = false
    hls = false
    mse = false
    eme = false

    canPlayType = spyFactory('canPlayType')
    canPlayTypeMse = spyFactory('canPlayTypeMse')
    supportsKeySystem = spyFactory('supportsKeySystem')
}
