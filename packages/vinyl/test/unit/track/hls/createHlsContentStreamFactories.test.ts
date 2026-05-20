/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ContentStreamImpl,
    createHlsContentStreamFactories,
    type HlsContentStreamTrackDeps,
    type MediaTimeline,
} from '@amazon/vinyl'
import {
    MockMediaSourceController,
    MockPlaybackController,
    MockQualitySelector,
} from '@amazon/vinyl/vinylTestUtil'
import { createContainer } from '@amazon/vinyl-di'
import { data } from '@amazon/vinyl-observable'

import any = jasmine.any

describe('createHlsContentStreamFactories', () => {
    let deps: HlsContentStreamTrackDeps

    const emptyTimeline: MediaTimeline = { periods: [], minBufferTime: 0 }

    beforeEach(() => {
        deps = {
            mediaSourceController: new MockMediaSourceController(),
            playbackController: new MockPlaybackController(),
            mediaTimelineTransformed: data(Promise.resolve(emptyTimeline)),
            qualitySelector: new MockQualitySelector(),
        }
    })

    it('creates a memoized factory function', () => {
        const createFactories = createHlsContentStreamFactories(null)(deps)
        expect(createFactories).toEqual(any(Function))
    })

    it('returns the same factories for the same content type', () => {
        const createFactories = createHlsContentStreamFactories(null)(deps)
        const first = createFactories('audio')
        const second = createFactories('audio')
        expect(first).toBe(second)
    })

    it('returns different factories for different content types', () => {
        const createFactories = createHlsContentStreamFactories(null)(deps)
        const audio = createFactories('audio')
        const video = createFactories('video')
        expect(audio).not.toBe(video)
    })

    it('factories can create a ContentStreamImpl', () => {
        const createFactories = createHlsContentStreamFactories(null)(deps)
        const factories = createFactories('audio')
        const stream = new ContentStreamImpl(factories, 'audio')
        stream.preload({ prefetchPriority: 1, startTime: 0 })
        stream.activate({ startTime: 0 })
        expect(stream).toBeDefined()
        stream.dispose()
    })

    it('provides options to sub-controllers', () => {
        const createFactories = createHlsContentStreamFactories({
            buffering: { minBuffer: 3.1 },
            segmentController: { prefetchActive: 5.2 },
        })(deps)
        const container = createContainer(createFactories('audio'))
        const streamDeps = container.dependencies
        expect(streamDeps.bufferingController.options.minBuffer).toBe(3.1)
        expect(streamDeps.segmentController.options.prefetchActive).toBe(5.2)
        container.dispose()
    })
})
