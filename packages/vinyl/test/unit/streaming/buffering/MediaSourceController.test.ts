/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type ContentType,
    MediaSourceControllerImpl,
    type MediaSourceControllerImplDeps,
    MediaSourceError,
} from '@amazon/vinyl'
import { Deferred, type ReadonlySet } from '@amazon/vinyl-util'
import {
    flushPromises,
    MockMediaSource,
    MockSourceBuffer,
} from '@amazon/vinyl-util/browserTestUtil'
import { data, type MutableValue } from '@amazon/vinyl-observable'
import createSpy = jasmine.createSpy
import objectContaining = jasmine.objectContaining
import Spy = jasmine.Spy
import { createEventSpy } from '@amazon/vinyl-util/testUtil'

describe('MediaSourceControllerImpl', () => {
    let mediaSourceFactory: Spy<() => MediaSource>
    let contentTypesValue: MutableValue<Promise<ReadonlySet<ContentType>>>
    let mockMediaSource: MockMediaSource
    let deps: MediaSourceControllerImplDeps
    let controller: MediaSourceControllerImpl

    beforeEach(() => {
        mockMediaSource = new MockMediaSource()
        mockMediaSource.addSourceBuffer.and.callFake(
            () => new MockSourceBuffer()
        )

        mediaSourceFactory =
            createSpy('mediaSourceFactory').and.returnValue(mockMediaSource)
        contentTypesValue = data<Promise<ReadonlySet<ContentType>>>(
            Promise.resolve(new Set(['audio']))
        )

        deps = {
            mediaSourceFactory,
            contentTypesValue,
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
        it('gets duration from media source', () => {
            mockMediaSource.duration = 123.45
            expect(controller.duration).toBe(123.45)
        })

        it('sets duration on media source', () => {
            controller.duration = 67.89
            expect(mockMediaSource.duration).toBe(67.89)
        })
    })

    describe('createSourceBuffer', () => {
        let mockSourceBuffer: SourceBuffer

        beforeEach(() => {
            mockSourceBuffer = new MockSourceBuffer()
            mockMediaSource.addSourceBuffer.and.returnValue(mockSourceBuffer)
        })

        it('creates source buffer with correct mime type', () => {
            const controller = new MediaSourceControllerImpl(deps)

            const ref = controller.createSourceBuffer('audio', 'audio/mp4')
            expect(mockMediaSource.addSourceBuffer).toHaveBeenCalledWith(
                'audio/mp4'
            )
            expect(ref.value).toBe(mockSourceBuffer)
        })

        it('sets source buffer mode to sequence', () => {
            const controller = new MediaSourceControllerImpl(deps)
            controller.createSourceBuffer('audio', 'audio/mp4')
            expect(mockSourceBuffer.mode).toBe('sequence')
        })

        it('emits error events when contentTypesValue rejects', async () => {
            const controller = new MediaSourceControllerImpl(deps)
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
            it('is true when all streams have been created', async () => {
                const controller = new MediaSourceControllerImpl(deps)
                const readyToAppendSpy = createEventSpy(
                    controller,
                    'readyToAppend'
                )
                expect(controller.readyToAppend).toBeFalse()
                await flushPromises()
                expect(readyToAppendSpy).not.toHaveBeenCalled()
                controller.createSourceBuffer('audio', 'audio/mp4')
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
            const controller = new MediaSourceControllerImpl(deps)

            const error = new Error('test error')
            mockMediaSource.addSourceBuffer.and.throwError(error)

            expect(() =>
                controller.createSourceBuffer('audio', 'invalid/type')
            ).toThrowError(MediaSourceError, 'error creating source buffer')
        })

        describe('SourceBufferRef disposal', () => {
            it('removes source buffer from media source', () => {
                const controller = new MediaSourceControllerImpl(deps)
                mockMediaSource.readyState = 'open'

                const ref = controller.createSourceBuffer('audio', 'audio/mp4')
                ref.dispose()
                expect(mockMediaSource.removeSourceBuffer).toHaveBeenCalledWith(
                    mockSourceBuffer
                )
            })

            it('does not remove source buffer when media source is closed', () => {
                const controller = new MediaSourceControllerImpl(deps)
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
