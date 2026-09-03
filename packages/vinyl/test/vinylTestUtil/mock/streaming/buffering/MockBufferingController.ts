/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import type {
    BufferingController,
    BufferingControllerEventMap,
    MediaQualityMetadata,
} from '@amazon/vinyl'
import { MockEventHost } from '@amazon/vinyl-util/testUtil'

const spyFactory = createSpyFactory<BufferingController>()

export class MockBufferingController
    extends MockEventHost<BufferingControllerEventMap>
    implements BufferingController
{
    error: Error | null = null
    active = false
    bufferingEnded = false
    playbackQuality: MediaQualityMetadata | null = null
    bufferingQuality: MediaQualityMetadata | null = null
    activate = spyFactory('activate')
    deactivate = spyFactory('deactivate')
    clear = spyFactory('clear')
    reset = spyFactory('reset')
}
