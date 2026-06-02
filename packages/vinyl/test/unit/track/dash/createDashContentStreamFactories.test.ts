/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ContentStreamImpl,
    createDashContentStreamFactories,
    type DashContentStreamTrackDeps,
    type MediaTimeline,
} from '@amazon/vinyl'
import {
    MockMediaSourceController,
    MockPlaybackController,
    MockQualitySelector,
} from '@amazon/vinyl/vinylTestUtil'
import { data } from '@amazon/vinyl-observable'
import any = jasmine.any
import { createContainer } from '@amazon/vinyl-di'

describe('createDashContentStreamFactories', () => {
    let deps: DashContentStreamTrackDeps
    let mediaSourceController: MockMediaSourceController
    let playbackController: MockPlaybackController
    let qualitySelector: MockQualitySelector

    const emptyTimeline: MediaTimeline = {
        periods: [],
        minBufferTime: 0,
        getDuration: () => Promise.resolve(Infinity),
    }

    beforeEach(() => {
        mediaSourceController = new MockMediaSourceController()
        playbackController = new MockPlaybackController()
        qualitySelector = new MockQualitySelector()

        deps = {
            mediaSourceController,
            playbackController,
            mediaTimelineTransformed: data(Promise.resolve(emptyTimeline)),
            qualitySelector,
        }
    })

    it('creates factories function that returns Factories<ContentStreamImplDeps>', () => {
        const createFactories = createDashContentStreamFactories(null)(deps)
        expect(createFactories).toEqual(any(Function))

        const factories = createFactories('audio')
        expect(factories).toBeDefined()
        expect(typeof factories).toBe('object')
    })

    it('creates different factories for different content types', () => {
        const createFactories = createDashContentStreamFactories(null)(deps)

        const audioFactories = createFactories('audio')
        const videoFactories = createFactories('video')

        expect(audioFactories).not.toBe(videoFactories)

        const audioFactories2 = createFactories('audio')
        expect(audioFactories2).toBe(audioFactories)
    })

    it('factories can be used to create a new ContentStreamImpl', () => {
        const createFactories = createDashContentStreamFactories(null)(deps)
        const factories = createFactories('audio')

        // Create ContentStream to trigger factory instantiation
        const contentStream = new ContentStreamImpl(factories, 'audio')

        // Exercise methods to ensure all factories are used
        contentStream.preload({ prefetchPriority: 1, startTime: 0 })
        contentStream.activate({ startTime: 0 })

        expect(contentStream).toBeDefined()
        contentStream.dispose()
    })

    it('provides options to sub-controllers', () => {
        const createFactories = createDashContentStreamFactories({
            buffering: {
                minBuffer: 3.1,
            },
            segmentController: {
                prefetchActive: 5.2,
            },
        })(deps)
        const audioContentStreamDepsContainer = createContainer(
            createFactories('audio')
        )
        const audioContentStreamDeps =
            audioContentStreamDepsContainer.dependencies

        expect(
            audioContentStreamDeps.bufferingController.options.minBuffer
        ).toBe(3.1)
        expect(
            audioContentStreamDeps.segmentController.options.prefetchActive
        ).toBe(5.2)
        audioContentStreamDepsContainer.dispose()
    })
})
