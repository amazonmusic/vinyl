/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createSegmentControllerFactory,
    type MediaTimeline,
} from '@amazon/vinyl'
import { MockPlaybackController } from '@amazon/vinyl/vinylTestUtil'
import { data } from '@amazon/vinyl-observable'

import objectContaining = jasmine.objectContaining

describe('createSegmentControllerFactory', () => {
    it('creates SegmentControllerImpl with merged dependencies', () => {
        const playbackController = new MockPlaybackController()
        const emptyTimeline: MediaTimeline = {
            periods: [],
            minBufferTime: 0,
            getDuration: () => Promise.resolve(Infinity),
        }

        const factory = createSegmentControllerFactory(
            { playbackController },
            'audio',
            { prefetchActive: 100 }
        )

        const controller = factory({
            mediaTimelineTransformed: data(Promise.resolve(emptyTimeline)),
            qualitySelector: { selectQuality: () => 0 },
        })

        expect(controller).toEqual(jasmine.any(Object))
        expect(controller.options).toEqual(
            objectContaining({ prefetchActive: 100 })
        )
    })
})
