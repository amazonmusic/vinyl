/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import {
    type MediaSourceController,
    type MediaSourceControllerEventMap,
} from '@amazon/vinyl'
import { MockEventHost } from '@amazon/vinyl-util/testUtil'

const spyFactory = createSpyFactory<MediaSourceController>()

export class MockMediaSourceController
    extends MockEventHost<MediaSourceControllerEventMap>
    implements MediaSourceController
{
    readyState: ReadyState = 'closed'
    createSourceBuffer = spyFactory('createSourceBuffer')
    endOfStream = spyFactory('endOfStream')
    createUrl = spyFactory('createUrl')
    readyToAppend = false
}
