/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import {
    type MediaQualityMetadata,
    type SegmentController,
    type SegmentControllerEventMap,
} from '@amazon/vinyl'
import { emptyRanges } from '@amazon/vinyl-util'
import { MockEventHost } from '@amazon/vinyl-util/testUtil'

const spyFactory = createSpyFactory<SegmentController>()

export class MockSegmentController
    extends MockEventHost<SegmentControllerEventMap>
    implements SegmentController
{
    error: Error | null = null

    getDuration = spyFactory('getDuration')

    configure = spyFactory('configure')

    fetchedRanges = emptyRanges

    activate = spyFactory('activate')

    clear = spyFactory('clear')

    deactivate = spyFactory('deactivate')

    getSegment = spyFactory('getSegment')

    streamingQuality: MediaQualityMetadata | null = null

    reset = spyFactory('reset')
}
