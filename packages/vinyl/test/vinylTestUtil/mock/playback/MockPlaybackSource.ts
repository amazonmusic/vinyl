/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CrossOrigin, PlaybackSource } from '@amazon/vinyl'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'

const spyFactory = createSpyFactory<PlaybackSource>()
export class MockPlaybackSource implements PlaybackSource {
    crossOrigin: CrossOrigin = null
    currentSrc = ''
    src: string | null = null
    srcObject: MediaStream | null = null
    disableRemotePlayback = false

    load = spyFactory('load')
}
