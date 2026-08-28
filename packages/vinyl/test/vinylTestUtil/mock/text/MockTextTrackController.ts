/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TextTrackController, TextTrackInfo } from '../../../../src'
import { MockEventHost } from '@amazon/vinyl-util/testUtil'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'

const spyFactory = createSpyFactory<TextTrackController>()

export class MockTextTrackController
    extends MockEventHost
    implements TextTrackController
{
    textTracks: readonly TextTrackInfo[] = []
    activeTextTrack: TextTrackInfo | null = null
    active = false

    deactivate = spyFactory('deactivate')
    activate = spyFactory('activate')
}
