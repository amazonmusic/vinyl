/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    PlaybackController,
    PlaybackControllerEventMap,
} from '@amazon/vinyl'
import { PlaybackNetworkState, PlaybackReadyState } from '@amazon/vinyl'
import { RangesImpl } from '@amazon/vinyl-util'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import { MockEventHost } from '@amazon/vinyl-util/testUtil'

const spyFactory = createSpyFactory<PlaybackController>()

export class MockPlaybackController
    extends MockEventHost<PlaybackControllerEventMap>
    implements PlaybackController
{
    buffered = new RangesImpl()
    canPlay = false
    canPlayThrough = false
    currentTime = 0
    currentTimePercent = 0
    defaultPlaybackRate = 0
    duration = 0
    ended = false
    error: Error | null = null
    hasMetadata = false
    loop = false
    muted = false
    networkState: PlaybackNetworkState = PlaybackNetworkState.NETWORK_IDLE
    pause = spyFactory('pause')
    paused = false
    play = spyFactory('play')
    playIsPending = false
    playbackRate = 0
    playing = false
    preservesPitch = true
    readyState: PlaybackReadyState = PlaybackReadyState.HAVE_NOTHING
    reset = spyFactory('reset')
    seekTo = spyFactory('seekTo')
    seekable = new RangesImpl()
    seeking = false
    volume = 0
    waiting = false
}
