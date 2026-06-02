/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type ContentType,
    DURATION_PADDING,
    LIVE_DURATION,
    type MediaTimeline,
    MediaSourceControllerImpl,
    type MediaSourceControllerImplDeps,
    MediaSourceError,
} from '@amazon/vinyl'
import { AbortError, Deferred, type ReadonlySet } from '@amazon/vinyl-util'
import {
    flushPromises,
    implementEventFakes,
    mockEvent,
    MockMediaSource,
    MockSourceBuffer,
} from '@amazon/vinyl-util/browserTestUtil'
import { data, type MutableValue } from '@amazon/vinyl-observable'
import createSpy = jasmine.createSpy
import objectContaining = jasmine.objectContaining
import Spy = jasmine.Spy
import { createEventSpy } from '@amazon/vinyl-util/testUtil'

const VOD_DURATION = 60
function createVodTimeline(duration: number = VOD_DURATION): MediaTimeline {
    return {
        periods: [],
        minBufferTime: 0,
        getDuration: () => Promise.resolve(duration),
    }
}
const liveTimeline: MediaTimeline = {
    periods: [],
    minBufferTime: 0,
    getDuration: () => Promise.resolve(Infinity),
}

describe('MediaSourceControllerImpl', () => {
    let mediaSourceFactory: Spy<() => MediaSource>
    let contentTypesValue: MutableValue<Promise<ReadonlySet<ContentType>>>
    let mediaTimelineTransformed: MutableValue<Promise<MediaTimeline>>
    let mockMediaSource: MockMediaSource
    let deps: MediaSourceControllerImplDeps
    let controller: MediaSourceControllerImpl

    function open(): void {
        mockMediaSource.readyState = 'open'
        mockMediaSource.dispatchEvent(mockEvent('sourceopen'))
    }

    beforeEach(() => {
        mockMediaSource = new MockMediaSource()
        implementEventFakes(mockMediaSource)
        mockMediaSource.addSourceBuffer.and.callFake(
            () => new MockSourceBuffer()
        )

        mediaSourceFactory =
            createSpy('mediaSourceFactory').and.returnValue(mockMediaSource)
        contentTypesValue = data<Promise<ReadonlySet<ContentType>>>(
            Promise.resolve(new Set(['audio']))
        )
        mediaTimelineTransformed = data<Promise<MediaTimeline>>(
            Promise.resolve(createVodTimeline())
        )

        deps = {
            mediaSourceFactory,
            contentTypesValue,
            mediaTimelineTransformed,
        }

        controller = new MediaSourceControllerImpl(deps)
    })

    afterEach(() => {
        controller.dispose()
    })

    describe('constructor', () => {
        it('creates media source using factory', () => {
            expect(mediaSourceFactory).toHaveBeenCalledOnceWith()
        })
    })

    describe('readyState', () => {
        it('returns media source ready state', () => {
            mockMediaSource.readyState = 'open'
            expect(controller.readyState).toBe('open')
        })
    })

    describe('duration', () => {
        it('sets media source duration after sourceopen', async () => {
            open()
            await flushPromises()
            expect(mockMediaSource.duration).toBe(
                VOD_DURATION + DURATION_PADDING
            )
        })

        it('uses LIVE_DURATION for live timelines', async () => {
            mediaTimelineTransformed.value = Promise.resolve(liveTimeline)
            open()
            await flushPromises()
            expect(mockMediaSource.duration).toBe(LIVE_DURATION)
        })

        it('does not set duration when media source is not open', async () => {
            await flushPromises()
            expect(mockMediaSource.duration).toBe(0)
        })

        it('refreshes duration when timeline changes', async () => {
            open()
            await flushPromises()
            expect(mockMediaSource.duration).toBe(
                VOD_DURATION + DURATION_PADDING
            )
            mediaTimelineTransformed.value = Promise.resolve(
                createVodTimeline(120)
            )
            await flushPromises()
            expect(mockMediaSource.duration).toBe(120 + DURATION_PADDING)
        })

        it('emits an error if getDuration rejects', async () => {
            const errorSpy = createEventSpy(controller, 'error')
            const error = new Error('expected')
            mediaTimelineTransformed.value = Promise.resolve({
                periods: [],
                minBufferTime: 0,
                getDuration: () => Promise.reject(error),
            })
            open()
            await flushPromises()
            expect(errorSpy).toHaveBeenCalledWith({
                target: controller,
                error,
            })
        })

        it('does not emit silent (abort) errors', async () => {
            const errorSpy = createEventSpy(controller, 'error')
            mediaTimelineTransformed.value = Promise.resolve({
                periods: [],
                minBufferTime: 0,
                getDuration: () => Promise.reject(new AbortError()),
            })
            open()
            await flushPromises()
            expect(errorSpy).not.toHaveBeenCalled()
        })

        it('discards a duration result if the source closed before it resolved', async () => {
            const deferred = new Deferred<number>()
            mediaTimelineTransformed.value = Promise.resolve({
                periods: [],
                minBufferTime: 0,
                getDuration: () => deferred,
            })
            open()
            await flushPromises()
            // Close before the duration resolves; the late result should be ignored.
            mockMediaSource.readyState = 'closed'
            mockMediaSource.dispatchEvent(mockEvent('sourceclose'))
            deferred.resolve(123)
            await flushPromises()
            expect(mockMediaSource.duration).toBe(0)
            expect(controller.readyToAppend).toBeFalse()
        })
    })

    describe('createSourceBuffer', () => {
        let mockSourceBuffer: SourceBuffer

        beforeEach(() => {
            mockSourceBuffer = new MockSourceBuffer()
            mockMediaSource.addSourceBuffer.and.returnValue(mockSourceBuffer)
        })

        it('creates source buffer with correct mime type', () => {
            const ref = controller.createSourceBuffer('audio', 'audio/mp4')
            expect(mockMediaSource.addSourceBuffer).toHaveBeenCalledWith(
                'audio/mp4'
            )
            expect(ref.value).toBe(mockSourceBuffer)
        })

        it('sets source buffer mode to sequence', () => {
            controller.createSourceBuffer('audio', 'audio/mp4')
            expect(mockSourceBuffer.mode).toBe('sequence')
        })

        it('emits error events when contentTypesValue rejects', async () => {
            const errorSpy = createEventSpy(controller, 'error')
            const error = new Error('expected error')
            contentTypesValue.value = Promise.reject(error)
            await flushPromises()
            expect(errorSpy).toHaveBeenCalledWith({
                target: controller,
                error,
            })
        })

        describe('readyToAppend', () => {
            it('is true only after duration is set and all source buffers are created', async () => {
                // Each createSourceBuffer must return a distinct SourceBuffer because
                // the controller dedupes buffers by identity.
                mockMediaSource.addSourceBuffer.and.callFake(
                    () => new MockSourceBuffer()
                )
                const readyToAppendSpy = createEventSpy(
                    controller,
                    'readyToAppend'
                )
                expect(controller.readyToAppend).toBeFalse()
                await flushPromises()
                expect(readyToAppendSpy).not.toHaveBeenCalled()

                // Source buffer alone is not enough — duration must be set.
                controller.createSourceBuffer('audio', 'audio/mp4')
                expect(controller.readyToAppend).toBeFalse()
                expect(readyToAppendSpy).not.toHaveBeenCalled()

                open()
                await flushPromises()
                expect(controller.readyToAppend).toBeTrue()
                expect(readyToAppendSpy).toHaveBeenCalledTimes(1)
                readyToAppendSpy.calls.reset()

                const newTypes = new Deferred<ReadonlySet<ContentType>>()
                contentTypesValue.value = newTypes
                expect(controller.readyToAppend).toBeFalse()
                newTypes.resolve(new Set(['audio', 'video']))
                await flushPromises()
                expect(controller.readyToAppend).toBeFalse()
                expect(readyToAppendSpy).not.toHaveBeenCalled()
                controller.createSourceBuffer('video', 'video/mp4')
                await flushPromises()
                expect(controller.readyToAppend).toBeTrue()
                expect(readyToAppendSpy).toHaveBeenCalledTimes(1)
            })
        })

        it('throws MediaSourceError when addSourceBuffer fails', () => {
            const error = new Error('test error')
            mockMediaSource.addSourceBuffer.and.throwError(error)

            expect(() =>
                controller.createSourceBuffer('audio', 'invalid/type')
            ).toThrowError(MediaSourceError, 'error creating source buffer')
        })

        describe('SourceBufferRef disposal', () => {
            it('removes source buffer from media source', () => {
                mockMediaSource.readyState = 'open'

                const ref = controller.createSourceBuffer('audio', 'audio/mp4')
                ref.dispose()
                expect(mockMediaSource.removeSourceBuffer).toHaveBeenCalledWith(
                    mockSourceBuffer
                )
            })

            it('does not remove source buffer when media source is closed', () => {
                mockMediaSource.readyState = 'open'

                const ref = controller.createSourceBuffer('audio', 'audio/mp4')
                mockMediaSource.readyState = 'closed'
                ref.dispose()
                expect(
                    mockMediaSource.removeSourceBuffer
                ).not.toHaveBeenCalled()
            })
        })
    })

    describe('endOfStream', () => {
        it('calls endOfStream on media source', () => {
            controller.endOfStream()
            expect(mockMediaSource.endOfStream).toHaveBeenCalledWith(undefined)
        })

        it('passes error to media source', () => {
            controller.endOfStream('decode')
            expect(mockMediaSource.endOfStream).toHaveBeenCalledWith('decode')
        })
    })

    describe('createUrl', () => {
        it('creates object URL for media source', () => {
            spyOn(URL, 'createObjectURL').and.returnValue('blob:test-url')
            const url = controller.createUrl()
            expect(URL.createObjectURL).toHaveBeenCalledWith(mockMediaSource)
            expect(url).toBe('blob:test-url')
        })
    })
})

describe('MediaSourceError', () => {
    it('creates error with message and reason', () => {
        const reason = new Error('original error')
        const error = new MediaSourceError('test message', reason)

        expect(error.message).toBe('test message')
        expect(error.toJSON()).toEqual(
            objectContaining({
                message: 'test message',
                reason: objectContaining({
                    message: 'original error',
                }),
            })
        )
    })
})
