/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    APPEND_WINDOW_END_OFFSET,
    APPEND_WINDOW_START_OFFSET,
    SourceBufferControllerImpl,
    SourceBufferError,
} from '@amazon/vinyl'
import {
    AbortError,
    type Disposable,
    emptyRanges,
    ErrorOrigin,
    IllegalStateError,
} from '@amazon/vinyl-util'
import {
    flushPromises,
    implementEventFakes,
    mockEvent,
    MockSourceBuffer,
    MockTimeRanges,
} from '@amazon/vinyl-util/browserTestUtil'
import { useMockLogger } from '@amazon/vinyl-util/testUtil'
import { MockMediaSourceController } from '@amazon/vinyl/vinylTestUtil'
import createSpy = jasmine.createSpy
import Spy = jasmine.Spy
import objectContaining = jasmine.objectContaining

interface MockSourceBufferRef extends Disposable {
    readonly value: MockSourceBuffer
    dispose: Spy
    mediaSourceReadyState: ReadyState
}

describe('SourceBufferControllerImpl', () => {
    useMockLogger()
    const data = new ArrayBuffer(0)
    const mimeType1 = 'video/mp4; codecs="avc1"'
    const mimeType2 = 'audio/mp4; codecs="flac"'

    let controller: SourceBufferControllerImpl
    let sourceBuffer: MockSourceBuffer | null
    let mediaSourceController: MockMediaSourceController

    function getMockSourceBufferRef(): MockSourceBufferRef {
        return mediaSourceController.createSourceBuffer.calls.mostRecent()
            .returnValue
    }

    async function updateDone() {
        sourceBuffer!.updating = false
        sourceBuffer!.dispatchEvent(mockEvent('update'))
        await flushPromises()
    }

    async function updateAbort() {
        sourceBuffer!.updating = false
        sourceBuffer!.dispatchEvent(mockEvent('abort'))
        await flushPromises()
    }

    async function updateError() {
        sourceBuffer!.updating = false
        sourceBuffer!.dispatchEvent(mockEvent('error'))
        await flushPromises()
    }

    beforeEach(() => {
        sourceBuffer = null
        mediaSourceController = new MockMediaSourceController()
        mediaSourceController.readyToAppend = true
        mediaSourceController.createSourceBuffer.and.callFake(() => {
            sourceBuffer = new MockSourceBuffer()
            sourceBuffer.buffered = new MockTimeRanges()
            implementEventFakes(sourceBuffer)
            let appendWindowStart = 0
            let appendWindowEnd = Number.POSITIVE_INFINITY
            let timestampOffset = 0

            function assertValidWindow() {
                expect(appendWindowStart)
                    .withContext('appendWindowStart')
                    .toBeLessThanOrEqual(appendWindowEnd)
            }

            Object.defineProperty(sourceBuffer, 'timestampOffset', {
                get() {
                    return timestampOffset
                },

                set(value) {
                    timestampOffset = value
                },
            })

            // Add safeties to assert that appendWindowStart is never set to after appendWindowEnd
            Object.defineProperty(sourceBuffer, 'appendWindowStart', {
                get() {
                    return appendWindowStart
                },

                set(value) {
                    appendWindowStart = value
                    assertValidWindow()
                },
            })

            Object.defineProperty(sourceBuffer, 'appendWindowEnd', {
                get() {
                    return appendWindowEnd
                },

                set(value) {
                    appendWindowEnd = value
                    assertValidWindow()
                },
            })

            return {
                get value(): MockSourceBuffer {
                    return sourceBuffer!
                },
                dispose: createSpy('dispose').and.callFake(() => {
                    sourceBuffer = null
                }),
            }
        })
        controller = new SourceBufferControllerImpl(
            {
                mediaSourceController,
            },
            'audio'
        )
    })

    afterEach(async () => {
        await flushPromises()
        expect(controller.isBusy()).withContext('isBusy').toBeFalse()
    })

    describe('enqueue', () => {
        it('enqueues a task to execute when the source buffer is next idle', async () => {
            expect(await controller.enqueue(() => Promise.resolve(3))).toBe(3)
            await controller.appendInit(data, mimeType1)
            sourceBuffer!.updating = true
            const task = controller.enqueue(() => Promise.resolve(4))
            await expectAsync(task).toBePending()
            await updateDone()
            await expectAsync(task).toBeResolvedTo(4)
        })
    })

    describe('appendInit', () => {
        describe('when first called', () => {
            it('creates a new backing source buffer', async () => {
                await controller.appendInit(data, mimeType1)
                expect(sourceBuffer).not.toBeNull()
                expect(
                    mediaSourceController.createSourceBuffer
                ).toHaveBeenCalledOnceWith('audio', 'video/mp4; codecs="avc1"')
                expect(sourceBuffer!.appendBuffer).toHaveBeenCalled()
            })

            it('waits for mediaSourceController.readyToAppend before appending', async () => {
                mediaSourceController.readyToAppend = false
                const appendPromise = controller.appendInit(data, mimeType1)
                expect(sourceBuffer).not.toBeNull()
                expect(sourceBuffer!.appendBuffer).not.toHaveBeenCalled()
                await expectAsync(appendPromise).toBePending()
                mediaSourceController.readyToAppend = true
                mediaSourceController.dispatch('readyToAppend', {})
                await expectAsync(appendPromise).toBeResolved()
                expect(sourceBuffer!.appendBuffer).toHaveBeenCalledTimes(1)
            })

            describe('then called again', () => {
                beforeEach(async () => {
                    await controller.appendInit(data, mimeType1)
                })

                describe('when changeType is supported', () => {
                    it('calls changeType with the new mime type', async () => {
                        const previousSourceBuffer = sourceBuffer
                        mediaSourceController.createSourceBuffer.calls.reset()
                        await controller.appendInit(data, mimeType2)
                        expect(sourceBuffer).not.toBeNull()
                        expect(
                            mediaSourceController.createSourceBuffer
                        ).not.toHaveBeenCalled()
                        expect(previousSourceBuffer).toBe(sourceBuffer)
                        expect(
                            sourceBuffer!.changeType
                        ).toHaveBeenCalledOnceWith('audio/mp4; codecs="flac"')
                    })
                })

                describe('when changeType is not supported', () => {
                    beforeEach(() => {
                        // Simulates changeType not being supported by the user agent.
                        delete (sourceBuffer as any).changeType
                    })

                    it('creates a new backing source buffer', async () => {
                        const previousSourceBuffer = sourceBuffer
                        const previousSourceBufferRef = getMockSourceBufferRef()
                        mediaSourceController.createSourceBuffer.calls.reset()
                        await controller.appendInit(data, mimeType2)
                        // Expect previous source buffer to have been disposed.
                        expect(
                            previousSourceBufferRef.dispose
                        ).toHaveBeenCalledOnceWith()
                        expect(sourceBuffer).not.toBeNull()
                        expect(
                            mediaSourceController.createSourceBuffer
                        ).toHaveBeenCalledOnceWith(
                            'audio',
                            'audio/mp4; codecs="flac"'
                        )
                        expect(previousSourceBuffer).not.toBe(sourceBuffer)
                    })
                })
            })
        })
    })

    describe('when append is called before appendInit', () => {
        it('throws a SourceBufferError with INTERNAL origin', async () => {
            await expectAsync(controller.append(data)).toBeRejectedWith(
                objectContaining({
                    message: 'media segment provided before init segment',
                    name: 'SourceBufferError',
                    origin: ErrorOrigin.INTERNAL,
                })
            )
        })
    })

    describe('setTimestampOffset', () => {
        describe('when initialized', () => {
            beforeEach(async () => {
                await controller.appendInit(data, mimeType1)
            })

            it('sets timestampOffset', async () => {
                await controller.setTimestampOffset(5)
                expect(sourceBuffer!.timestampOffset).toEqual(5)

                await controller.setTimestampOffset(6)
                expect(sourceBuffer!.timestampOffset).toEqual(6)

                await controller.setTimestampOffset(6)

                await controller.setTimestampOffset(0)
                expect(sourceBuffer!.timestampOffset).toBe(0)
            })
        })

        describe('when not initialized', () => {
            it('rejects', async () => {
                await expectAsync(
                    controller.setTimestampOffset(0)
                ).toBeRejectedWithError(IllegalStateError)
            })
        })
    })

    describe('setAppendWindow', () => {
        describe('when initialized', () => {
            beforeEach(async () => {
                await controller.appendInit(data, mimeType1)
            })

            it('sets appendWindowStart and appendWindowEnd such that end is always greater than start', async () => {
                await controller.setAppendWindow(20, 30)
                expect(sourceBuffer!.appendWindowStart).toEqual(
                    20 - APPEND_WINDOW_START_OFFSET
                )
                expect(sourceBuffer!.appendWindowEnd).toEqual(
                    30 + APPEND_WINDOW_END_OFFSET
                )
                await controller.setAppendWindow(0, 10)
                expect(sourceBuffer!.appendWindowStart).toEqual(0)
                expect(sourceBuffer!.appendWindowEnd).toEqual(
                    10 + APPEND_WINDOW_END_OFFSET
                )

                // Append with same append window should no-op
                await controller.setAppendWindow(0, 10)

                // Defaults to 0, POSITIVE_INFINITY
                await controller.setAppendWindow()
                expect(sourceBuffer!.appendWindowStart).toEqual(0)
                expect(sourceBuffer!.appendWindowEnd).toEqual(
                    Number.POSITIVE_INFINITY
                )
            })
        })

        describe('when not initialized', () => {
            it('rejects', async () => {
                await expectAsync(
                    controller.setAppendWindow()
                ).toBeRejectedWithError(IllegalStateError)
            })
        })
    })

    describe('append', () => {
        beforeEach(async () => {
            await controller.appendInit(data, mimeType1)
        })

        it('appends media segments to the source buffer', async () => {
            await controller.append(data)
            expect(sourceBuffer!.appendBuffer).toHaveBeenCalledWith(data)
            expect(sourceBuffer!.timestampOffset).toEqual(0)
            expect(sourceBuffer!.appendWindowStart).toEqual(0)
            expect(sourceBuffer!.appendWindowEnd).toEqual(
                Number.POSITIVE_INFINITY
            )
        })

        it('enqueues append operation until source buffer is idle', async () => {
            sourceBuffer!.appendBuffer.and.callFake(() => {
                sourceBuffer!.updating = true
            })
            const appendPromise = controller.append(data)
            const appendPromise2 = controller.append(data)
            await expectAsync(appendPromise).toBePending()
            await flushPromises()
            await updateDone()
            await expectAsync(appendPromise).toBeResolved()
            await expectAsync(appendPromise2).toBePending()
            await updateDone()
            await expectAsync(appendPromise2).toBeResolved()
        })

        describe('when update is aborted', () => {
            it('rejects append promise with an an AbortError', async () => {
                sourceBuffer!.appendBuffer.and.callFake(() => {
                    sourceBuffer!.updating = true
                })
                const appendPromise = controller.append(data)
                await expectAsync(appendPromise).toBePending()
                await updateAbort()
                await expectAsync(appendPromise).toBeRejectedWith(
                    new AbortError()
                )
            })
        })

        describe('when update errs', () => {
            it('rejects append promise with a SourceBufferError', async () => {
                sourceBuffer!.appendBuffer.and.callFake(() => {
                    sourceBuffer!.updating = true
                })
                const appendPromise = controller.append(data)
                await expectAsync(appendPromise).toBePending()
                await updateError()
                await expectAsync(appendPromise).toBeRejectedWithError(
                    SourceBufferError
                )
            })
        })
    })

    describe('remove', () => {
        describe('when a backing source buffer has been created', () => {
            beforeEach(async () => {
                await controller.appendInit(data, mimeType1)
            })

            it('removes specified time range', async () => {
                sourceBuffer!.remove.and.callFake(() => {
                    sourceBuffer!.updating = true
                })

                const removePromise = controller.remove(10, 20)
                await flushPromises()
                await expectAsync(removePromise).toBePending()
                await updateDone()
                await expectAsync(removePromise).toBeResolved()
                expect(sourceBuffer!.remove).toHaveBeenCalledWith(10, 20)
            })

            describe('when startTime is after endTime', () => {
                it('does not call remove on backing source buffer', async () => {
                    await controller.remove(20, 10)
                    expect(sourceBuffer!.remove).not.toHaveBeenCalled()
                })
            })
        })

        describe('when a backing source buffer has not been created', () => {
            it('does nothing', async () => {
                await expectAsync(controller.remove(10, 20)).toBeResolved()
            })
        })
    })

    describe('clear', () => {
        describe('when a backing source buffer has been created', () => {
            beforeEach(async () => {
                await controller.appendInit(data, mimeType1)
            })

            it('clears all buffered data', async () => {
                await controller.clear()
                expect(sourceBuffer!.remove).toHaveBeenCalledWith(
                    0,
                    Number.POSITIVE_INFINITY
                )
            })
        })

        describe('when a backing source buffer has not been created', () => {
            it('does nothing', async () => {
                await expectAsync(controller.clear()).toBeResolved()
            })
        })
    })

    describe('buffered', () => {
        describe('when a backing buffer has not been created', () => {
            it('returns empty ranges', () => {
                expect(controller.buffered).toBe(emptyRanges)
            })
        })

        describe('when a backing buffer has been created', () => {
            beforeEach(async () => {
                await controller.appendInit(data, mimeType1)
            })

            it('returns the backing buffer ranges', () => {
                sourceBuffer!.buffered = new MockTimeRanges([
                    [1, 20],
                    [30, 40],
                ])
                expect(Array.from(controller.buffered)).toEqual([
                    [1, 20],
                    [30, 40],
                ])
            })

            it('caches the buffered ranges until the next update', async () => {
                sourceBuffer!.buffered = new MockTimeRanges([
                    [1, 20],
                    [30, 40],
                ])
                let cachedRanges = controller.buffered
                await controller.remove(0, 10)
                expect(controller.buffered).not.toBe(cachedRanges)
                cachedRanges = controller.buffered
                await controller.append(data)
                expect(controller.buffered).not.toBe(cachedRanges)
            })
        })
    })

    describe('dispose', () => {
        describe('when source buffer is creating', () => {
            it('disposes the source buffer', async () => {
                const appendPromise = controller.appendInit(data, mimeType1) // Request the source buffer
                controller.dispose()
                await expectAsync(appendPromise).toBeRejected()
                expect(
                    getMockSourceBufferRef().dispose
                ).toHaveBeenCalledOnceWith()
            })

            it('aborts awaiting readyToAppend and disposes the source buffer', async () => {
                mediaSourceController.readyToAppend = false
                const appendPromise = controller.appendInit(data, mimeType1) // Request the source buffer
                controller.dispose()
                await expectAsync(appendPromise).toBeRejected()
                expect(
                    getMockSourceBufferRef().dispose
                ).toHaveBeenCalledOnceWith()
            })
        })

        it('disposes the source buffer', async () => {
            await controller.appendInit(data, mimeType1) // Create the source buffer
            controller.dispose()
            expect(getMockSourceBufferRef().dispose).toHaveBeenCalledOnceWith()
        })
    })
})
