/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    ContentStream,
    ContentType,
    MediaQualityMetadata,
    StreamingEventMap,
} from '@amazon/vinyl'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import { MockEventHost } from '@amazon/vinyl-util/testUtil'
import { RangesImpl } from '@amazon/vinyl-util'

const spyFactory = createSpyFactory<ContentStream>()

export class MockContentStream
    extends MockEventHost<StreamingEventMap>
    implements ContentStream
{
    contentType: ContentType = 'audio'
    bufferingQuality: MediaQualityMetadata | null = null
    error: Error | null = null
    fetchedRanges = new RangesImpl()
    playbackQuality: MediaQualityMetadata | null = null
    streamingQuality: MediaQualityMetadata | null = null
    bufferingEnded = false

    clearPrefetch = spyFactory('clearPrefetch')

    activate = spyFactory('activate')

    deactivate = spyFactory('deactivate')

    preload = spyFactory('preload')

    reset = spyFactory('reset')
}
