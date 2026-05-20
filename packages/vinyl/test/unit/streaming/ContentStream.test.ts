/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type ContentStream,
    ContentStreamImpl,
    type ContentStreamImplDeps,
    createContentStreamFactory,
    createEmptyMediaQualityMetadata,
    type MediaQualityMetadata,
} from '@amazon/vinyl'
import { createEventSpy } from '@amazon/vinyl-util/testUtil'
import { emptyRanges } from '@amazon/vinyl-util'
import {
    MockBufferingController,
    MockSegmentController,
} from '@amazon/vinyl/vinylTestUtil'
import type { Factories } from '@amazon/vinyl-di'

describe('ContentStreamImpl', () => {
    let segmentController: MockSegmentController
    let bufferingController: MockBufferingController
    let contentStream: ContentStreamImpl
    let deps: Factories<ContentStreamImplDeps>

    const mockQuality: MediaQualityMetadata = createEmptyMediaQualityMetadata()

    beforeEach(() => {
        segmentController = new MockSegmentController()
        bufferingController = new MockBufferingController()

        deps = {
            segmentController: () => segmentController,
            bufferingController: () => bufferingController,
        }

        contentStream = new ContentStreamImpl(deps, 'audio')
    })

    afterEach(() => {
        contentStream.dispose()
    })

    describe('constructor', () => {
        it('creates instance and sets up event redispatching', () => {
            expect(contentStream).toBeInstanceOf(ContentStreamImpl)
        })

        it('redispatches fetchedRangesChange from segmentController', () => {
            const spy = createEventSpy(contentStream, 'fetchedRangesChange')
            segmentController.dispatch('fetchedRangesChange', {})
            expect(spy).toHaveBeenCalledWith({})
        })

        it('redispatches streamingQualityChange from segmentController', () => {
            const spy = createEventSpy(contentStream, 'streamingQualityChange')
            const event = { current: mockQuality, previous: null }
            segmentController.dispatch('streamingQualityChange', event)
            expect(spy).toHaveBeenCalledWith(event)
        })

        it('redispatches bufferingQualityChange from bufferingController', () => {
            const spy = createEventSpy(contentStream, 'bufferingQualityChange')
            const event = { current: mockQuality, previous: null }
            bufferingController.dispatch('bufferingQualityChange', event)
            expect(spy).toHaveBeenCalledWith(event)
        })

        it('redispatches playbackQualityChange from bufferingController', () => {
            const spy = createEventSpy(contentStream, 'playbackQualityChange')
            const event = { current: mockQuality, previous: null }
            bufferingController.dispatch('playbackQualityChange', event)
            expect(spy).toHaveBeenCalledWith(event)
        })

        it('redispatches error from bufferingController', () => {
            const spy = createEventSpy(contentStream, 'error')
            const error = new Error('test error')
            const target = { logPrefix: 'test' }
            bufferingController.dispatch('error', { error, target })
            expect(spy).toHaveBeenCalledWith({ error, target })
        })
    })

    describe('preload', () => {
        it('configures segmentController with startTime and prefetchPriority', () => {
            contentStream.preload({
                prefetchPriority: 5,
                startTime: 10,
            })

            expect(segmentController.configure).toHaveBeenCalledWith({
                startTime: 10,
                trackPrefetchPriority: 5,
            })
        })

        it('uses default startTime of 0 when not provided', () => {
            contentStream.preload({
                prefetchPriority: 3,
            })

            expect(segmentController.configure).toHaveBeenCalledWith({
                startTime: 0,
                trackPrefetchPriority: 3,
            })
        })
    })

    describe('fetchedRanges', () => {
        it('returns fetchedRanges from segmentController', () => {
            const ranges = emptyRanges
            segmentController.fetchedRanges = ranges
            expect(contentStream.fetchedRanges).toBe(ranges)
        })
    })

    describe('streamingQuality', () => {
        it('returns streamingQuality from segmentController', () => {
            segmentController.streamingQuality = mockQuality
            expect(contentStream.streamingQuality).toBe(mockQuality)
        })

        it('returns null when segmentController streamingQuality is null', () => {
            segmentController.streamingQuality = null
            expect(contentStream.streamingQuality).toBeNull()
        })
    })

    describe('bufferingQuality', () => {
        it('returns bufferingQuality from bufferingController', () => {
            bufferingController.bufferingQuality = mockQuality
            expect(contentStream.bufferingQuality).toBe(mockQuality)
        })

        it('returns null when bufferingController bufferingQuality is null', () => {
            bufferingController.bufferingQuality = null
            expect(contentStream.bufferingQuality).toBeNull()
        })
    })

    describe('playbackQuality', () => {
        it('returns playbackQuality from bufferingController', () => {
            bufferingController.playbackQuality = mockQuality
            expect(contentStream.playbackQuality).toBe(mockQuality)
        })

        it('returns null when bufferingController playbackQuality is null', () => {
            bufferingController.playbackQuality = null
            expect(contentStream.playbackQuality).toBeNull()
        })
    })

    describe('bufferingEnded', () => {
        it('returns bufferingEnded from bufferingController', () => {
            bufferingController.bufferingEnded = true
            expect(contentStream.bufferingEnded).toBe(true)

            bufferingController.bufferingEnded = false
            expect(contentStream.bufferingEnded).toBe(false)
        })
    })

    describe('error', () => {
        it('returns error from bufferingController when present', () => {
            const error = new Error('buffering error')
            bufferingController.error = error
            segmentController.error = null

            expect(contentStream.error).toBe(error)
        })

        it('returns error from segmentController when bufferingController has no error', () => {
            const error = new Error('segment error')
            bufferingController.error = null
            segmentController.error = error

            expect(contentStream.error).toBe(error)
        })

        it('returns bufferingController error when both have errors', () => {
            const bufferingError = new Error('buffering error')
            const segmentError = new Error('segment error')
            bufferingController.error = bufferingError
            segmentController.error = segmentError

            expect(contentStream.error).toBe(bufferingError)
        })

        it('returns null when neither controller has error', () => {
            bufferingController.error = null
            segmentController.error = null

            expect(contentStream.error).toBeNull()
        })
    })

    describe('clearPrefetch', () => {
        it('calls clear on both controllers', () => {
            contentStream.clearPrefetch()

            expect(segmentController.clear).toHaveBeenCalled()
            expect(bufferingController.clear).toHaveBeenCalled()
        })
    })

    describe('reset', () => {
        it('calls reset on both controllers', () => {
            contentStream.reset()

            expect(segmentController.reset).toHaveBeenCalled()
            expect(bufferingController.reset).toHaveBeenCalled()
        })
    })

    describe('activate', () => {
        it('configures and activates segmentController, then activates bufferingController', () => {
            const loadOptions = { startTime: 5 }

            contentStream.activate(loadOptions)

            expect(segmentController.configure).toHaveBeenCalledWith({
                startTime: 5,
            })
            expect(segmentController.activate).toHaveBeenCalled()
            expect(bufferingController.activate).toHaveBeenCalled()
        })

        it('uses default startTime of 0 when not provided', () => {
            const loadOptions = {}

            contentStream.activate(loadOptions)

            expect(segmentController.configure).toHaveBeenCalledWith({
                startTime: 0,
            })
        })
    })

    describe('deactivate', () => {
        it('deactivates both controllers', () => {
            contentStream.deactivate()

            expect(segmentController.deactivate).toHaveBeenCalled()
            expect(bufferingController.deactivate).toHaveBeenCalled()
        })
    })

    describe('dispose', () => {
        it('disposes resources', () => {
            const testContentStream = new ContentStreamImpl(deps, 'audio')
            testContentStream.on('reset', () => {})
            testContentStream.dispose()
            expect(testContentStream.hasAnyListeners()).toBeFalse()
            expect(segmentController.dispose).toHaveBeenCalledOnceWith()
            expect(bufferingController.dispose).toHaveBeenCalledOnceWith()
        })
    })

    describe('createContentStreamFactory', () => {
        it('creates a ContentStreamFactory', () => {
            const factory = createContentStreamFactory({
                createContentStreamFactories: () => deps,
            })
            const contentStream: ContentStream = factory('audio')

            expect(contentStream.contentType).toBe('audio')
            contentStream.dispose()
        })
    })
})
