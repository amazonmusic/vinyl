/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    Track,
    TrackController,
    TrackControllerEventMap,
    TrackLoadOptions,
} from '@amazon/vinyl'
import { createSpyFactory } from '@amazon/vinyl-util/browserTestUtil'
import { MockEventHost } from '@amazon/vinyl-util/testUtil'

const spyFactory = createSpyFactory<TrackController<any>>()

export class MockTrackController<
        TrackLoadOptionsType extends TrackLoadOptions = TrackLoadOptions,
    >
    extends MockEventHost<TrackControllerEventMap<TrackLoadOptionsType>>
    implements TrackController<TrackLoadOptionsType>
{
    currentTrack: Track | null = null

    queue: any[] = []

    clearPrefetch = spyFactory('clearPrefetch')
    clearQueue = spyFactory('clearQueue')
    clearTrackCache = spyFactory('clearTrackCache')
    enqueue = spyFactory('enqueue')
    getCachedTrack = spyFactory('getCachedTrack')
    getCachedTracks = spyFactory('getCachedTracks')
    hasNext = spyFactory('hasNext')
    isTrackCached = spyFactory('isTrackCached')
    load = spyFactory('load')
    next = spyFactory('next')
    preload = spyFactory('preload')
    unload = spyFactory('unload')
    reset = spyFactory('reset')
}
