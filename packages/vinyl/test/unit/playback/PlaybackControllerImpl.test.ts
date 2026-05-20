/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type ChangeEvent,
    isNotAllowedError,
    LIVE_DURATION,
    type LoudnessNormalizationController,
    type PlaybackControllerEventMap,
    PlaybackControllerImpl,
    PlaybackReadyState,
    PlayedReason,
    type ProgressEvent,
    ReportableMediaError,
    WaitedReason,
} from '@amazon/vinyl'
import {
    AbortError,
    type AnyRecord,
    Deferred,
    ErrorLevel,
    ErrorOrigin,
    type EventHandler,
    last,
    ReadonlyRangesImpl,
    setUserAgent,
} from '@amazon/vinyl-util'
import {
    flushPromises,
    implementEventFakes,
    mockEvent,
    MockEvent,
    MockHTMLAudioElement,
    MockMediaError,
    MockTimeRanges,
    useMockTime,
} from '@amazon/vinyl-util/browserTestUtil'
import { createEventSpy, useMockLogger } from '@amazon/vinyl-util/testUtil'
import { MockLoudnessNormalizationController } from '@amazon/vinyl/vinylTestUtil'
import any = jasmine.any
import createSpy = jasmine.createSpy
import objectContaining = jasmine.objectContaining
import Spy = jasmine.Spy

describe('PlaybackController', () => {
    const notAllowedError = { name: 'NotAllowedError' } as const
    const notAuthorizedError = { name: 'NotAuthorizedError' } as const
    const clock = useMockTime()
    const loggingRef = useMockLogger()
    describe('PlaybackControllerImpl', () => {
        let media: MockHTMLAudioElement
        let loudnessNormalizationController: LoudnessNormalizationController
        beforeEach(() => {
            media = new MockHTMLAudioElement()
            media.buffered = new MockTimeRanges()
            media.seekable = new MockTimeRanges()
            loudnessNormalizationController =
                new MockLoudnessNormalizationController()
            implementEventFakes(media)
            media.play.and.returnValue(Promise.resolve())
        })

        /**
         * Tests that a delegated mutable property of PlaybackController properly maps to the media
         * element.
         */
        function testDelegate<
            K extends keyof PlaybackControllerImpl & keyof HTMLMediaElement,
        >(
            controller: PlaybackControllerImpl,
            prop: K,
            value: PlaybackControllerImpl[K]
        ) {
            if (
                Object.getOwnPropertyDescriptor(
                    PlaybackControllerImpl.prototype,
                    prop
                )!.set
            ) {
                controller[prop] = value
                expect(media[prop as keyof MockHTMLAudioElement]).toBe(value)
            }
            ;(media as any)[prop] = value
            expect(controller[prop]).toBe(value)
        }

        describe('when loudness normalization controller emits change event', () => {
            let controller: PlaybackControllerImpl
            let mockLoudnessController: MockLoudnessNormalizationController
            beforeEach(() => {
                mockLoudnessController =
                    new MockLoudnessNormalizationController()
                controller = new PlaybackControllerImpl({
                    media,
                    loudnessNormalizationController: mockLoudnessController,
                })
            })

            it('media volume is refreshed', () => {
                // Set up initial volume
                controller.volume = 0.8
                expect(media.volume).toBe(0.8)

                // Mock the gain value
                mockLoudnessController.gain = 0.5 // Simulated gain

                // Dispatch change event
                mockLoudnessController.dispatch('change', {})

                expect(controller.volume).toBe(0.8) // User volume should not be changed
                expect(media.volume).toBeCloseTo(0.4) // 0.8 * 0.5 = 0.4
            })
        })

        describe('with standard options', () => {
            let controller: PlaybackControllerImpl
            let mockLoudnessController: MockLoudnessNormalizationController
            beforeEach(() => {
                mockLoudnessController =
                    new MockLoudnessNormalizationController()
                controller = new PlaybackControllerImpl({
                    media,
                    loudnessNormalizationController: mockLoudnessController,
                })
            })

            afterEach(() => {
                if (!controller.disposed) controller.dispose()
            })

            it('assigns properties, methods, and events directly to a media object', () => {
                expect(controller.buffered).toBeInstanceOf(ReadonlyRangesImpl)
                testDelegate(controller, 'currentTime', 2)
                testDelegate(controller, 'duration', 3)
                testDelegate(controller, 'defaultPlaybackRate', 2)
                testDelegate(controller, 'ended', true)
                testDelegate(controller, 'loop', true)
                testDelegate(controller, 'muted', true)
                testDelegate(controller, 'networkState', 1)
                testDelegate(controller, 'paused', true)
                testDelegate(controller, 'playbackRate', 2)
                testDelegate(controller, 'preservesPitch', false)
                testDelegate(controller, 'readyState', 3)
                expect(controller.seekable).toBeInstanceOf(ReadonlyRangesImpl)
                testDelegate(controller, 'volume', 0)
            })

            describe('error', () => {
                it('is set on an error event', () => {
                    expect(controller.error).toBeNull()
                    const error = new MockMediaError()
                    error.code = 3
                    media.error = error
                    media.dispatchEvent(mockEvent('error'))
                    expect(controller.error).toBeInstanceOf(
                        ReportableMediaError
                    )
                    expect(controller.error).toEqual(
                        objectContaining<ReportableMediaError>({
                            code: 3,
                        })
                    )
                })

                it('is null after a reset', () => {
                    const error = new MockMediaError()
                    error.code = 3
                    media.error = error
                    media.dispatchEvent(mockEvent('error'))
                    expect(controller.error).not.toBeNull()
                    controller.reset()
                    expect(controller.error).toBeNull()
                })
            })

            describe('hasMetadata', () => {
                it('returns true if readyState is at least HAVE_METADATA', () => {
                    media.readyState = PlaybackReadyState.HAVE_NOTHING
                    expect(controller.hasMetadata).toBeFalse()
                    media.readyState = PlaybackReadyState.HAVE_METADATA
                    expect(controller.hasMetadata).toBeTrue()
                    media.readyState = PlaybackReadyState.HAVE_CURRENT_DATA
                    expect(controller.hasMetadata).toBeTrue()
                })
            })

            describe('canPlay', () => {
                it('returns true if readyState is at HAVE_FUTURE_DATA', () => {
                    media.readyState = PlaybackReadyState.HAVE_NOTHING
                    expect(controller.canPlay).toBeFalse()
                    media.readyState = PlaybackReadyState.HAVE_FUTURE_DATA
                    expect(controller.canPlay).toBeTrue()
                    media.readyState = PlaybackReadyState.HAVE_ENOUGH_DATA
                    expect(controller.canPlay).toBeTrue()
                })
            })

            describe('canPlayThrough', () => {
                it('returns true if readyState is at HAVE_ENOUGH_DATA', () => {
                    media.readyState = PlaybackReadyState.HAVE_NOTHING
                    expect(controller.canPlayThrough).toBeFalse()
                    media.readyState = PlaybackReadyState.HAVE_FUTURE_DATA
                    expect(controller.canPlayThrough).toBeFalse()
                    media.readyState = PlaybackReadyState.HAVE_ENOUGH_DATA
                    expect(controller.canPlayThrough).toBeTrue()
                })
            })

            describe('playIsPending', () => {
                it('returns true if a play promise is in a pending state', async () => {
                    media.readyState = PlaybackReadyState.HAVE_METADATA
                    const playPromise = new Deferred<void>()
                    media.play.and.returnValue(playPromise)
                    expect(controller.playIsPending).toBeFalse()
                    void controller.play()
                    await clock.tick()
                    expect(controller.playIsPending).toBeTrue()
                    playPromise.resolve(void 0)
                    await clock.tick()
                    expect(controller.playIsPending).toBeFalse()
                })
            })

            describe('seekTo', () => {
                /**
                 * Sets the ready state to HAVE_METADATA and sets the seekable ranges.
                 * @param ranges
                 */
                function setSeekable(
                    ranges: ReadonlyArray<readonly [start: number, end: number]>
                ): void {
                    media.readyState = PlaybackReadyState.HAVE_METADATA
                    media.dispatchEvent(mockEvent('loadedmetadata'))
                    media.duration = last(ranges)![1]
                    media.seekable = new MockTimeRanges(ranges)
                }

                /**
                 * Dispatches seeking/seeked events when seeking.
                 */
                function enableSeekAutoComplete() {
                    let currentTime = 0
                    Object.defineProperty(media, 'currentTime', {
                        get() {
                            return currentTime
                        },
                        set(value) {
                            currentTime = value
                            media.dispatchEvent(mockEvent('seeking'))
                            // add a frame delay to simulate the seek taking time
                            void (async () => {
                                await flushPromises()
                                media.dispatchEvent(mockEvent('seeked'))
                            })()
                        },
                    })
                }

                it('waits for metadata before initiating seek', async () => {
                    enableSeekAutoComplete()
                    const seeked = controller.seekTo(3)
                    setSeekable([[0, 10]])
                    expect(media.currentTime).toBe(0)
                    await seeked
                    expect(media.currentTime).toBe(3)
                })

                it('constrains seeks to allowable ranges within tolerance', async () => {
                    const minSeekableBuffer =
                        controller.options.minSeekableBuffer
                    enableSeekAutoComplete()
                    setSeekable([
                        [30, 50],
                        [70, 100],
                    ])
                    // default tolerance of 0.5
                    await controller.seekTo(100.5)
                    expect(media.currentTime).toBe(100 - minSeekableBuffer)
                    await controller.seekTo(29.5)
                    expect(media.currentTime).toBe(30)
                    await controller.seekTo(50.5)
                    expect(media.currentTime).toBe(50 - minSeekableBuffer)
                    await controller.seekTo(69.8, 0.2)
                    expect(media.currentTime).toBe(70)
                    await controller.seekTo(70)
                    expect(media.currentTime).toBe(70)

                    // clamps to 0-duration-MIN_SEEKABLE_BUFFER
                    await controller.seekTo(200, 110 - 100)
                    expect(media.currentTime).toBeCloseToWithin(
                        100 - minSeekableBuffer
                    )
                    await controller.seekTo(-200, 30)
                    expect(media.currentTime).toBe(30)

                    // if a range is not seekable, does not jump beyond a given tolerance
                    const unchangedTime = media.currentTime
                    loggingRef.value.warn.calls.reset()
                    await expectAsync(
                        controller.seekTo(29, 0.5)
                    ).toBeRejectedWithError(
                        'Could not seek to time: 29, outside of seekable ranges [[30, 50], [70, 100]] with tolerance 0.5'
                    )
                    expect(loggingRef.value.warn).toHaveBeenCalledOnceWith(
                        controller,
                        'seekTo: seek outside of seekable ranges, seek ignored'
                    )
                    loggingRef.value.warn.calls.reset()
                    expect(media.currentTime).toBe(unchangedTime)
                })

                describe('when there is no seekable range within tolerance after metadata', () => {
                    it('logs warning messages when necessary', async () => {
                        enableSeekAutoComplete()
                        setSeekable([
                            [3, 5],
                            [100, 120],
                        ])
                        await expectAsync(
                            controller.seekTo(10)
                        ).toBeRejectedWithError(
                            `Could not seek to time: 10, outside of seekable ranges [[3, 5], [100, 120]] with tolerance 0.5`
                        )
                        expect(loggingRef.value.warn).toHaveBeenCalledOnceWith(
                            controller,
                            'seekTo: seek outside of seekable ranges, seek ignored'
                        )
                    })
                })

                it('does not no-op if time is not within tolerance of seek time', async () => {
                    enableSeekAutoComplete()
                    const pendingSeek1 = controller.seekTo(3)
                    const pendingSeek2 = controller.seekTo(3.5, 0.4)

                    setSeekable([[0, 10]])
                    await expectAsync(pendingSeek1).toBeResolved()
                    await expectAsync(pendingSeek2).toBeResolved()
                    expect(controller.currentTime).toBe(3.5)
                })

                describe('when a seek is pending', () => {
                    describe('and seek time is within tolerance of pending seek time', () => {
                        it('does not set media currentTime unnecessarily', async () => {
                            setSeekable([[0, 10]])
                            enableSeekAutoComplete()
                            const pendingSeek1 = controller.seekTo(3, 1)
                            const pendingSeek2 = controller.seekTo(4, 1)
                            await pendingSeek1
                            await pendingSeek2
                            expect(media.currentTime).toEqual(3)
                        })
                    })

                    it('seeks to new location', async () => {
                        setSeekable([[0, 100]])
                        enableSeekAutoComplete()
                        const firstSeek = controller.seekTo(10)
                        const secondSeek = controller.seekTo(20)
                        const thirdSeek = controller.seekTo(30)

                        await expectAsync(firstSeek).toBePending()
                        await secondSeek
                        await firstSeek
                        await expectAsync(thirdSeek).toBeResolved()
                        expect(media.currentTime).toBe(30)
                    })
                })

                describe('when a seek is not pending', () => {
                    describe('and seek time is within tolerance of currentTime', () => {
                        it('no-ops', async () => {
                            enableSeekAutoComplete()
                            setSeekable([[0, 10]])
                            media.currentTime = 5
                            await controller.seekTo(5.5, 0.5)
                            expect(controller.currentTime).toBe(5)
                        })
                    })
                })

                it('times out after seekTimeout', async () => {
                    setSeekable([[0, 100]])

                    const seekExpectation = expectAsync(
                        controller.seekTo(50)
                    ).toBeRejectedWithError(
                        'seek timed out on seeking event after 30s'
                    )
                    await clock.tick(controller.options.seekTimeout)
                    await seekExpectation
                })

                it('times out pending seeks after seekTimeout', async () => {
                    const pendingSeekExpectation = expectAsync(
                        controller.seekTo(60)
                    ).toBeRejectedWithError(
                        'seek timed out on seeking event after 30s'
                    )
                    setSeekable([[0, 100]])
                    await flushPromises()
                    await clock.tick(controller.options.seekTimeout)
                    await pendingSeekExpectation
                })

                it('aborts seek when media is emptied', async () => {
                    setSeekable([[0, 100]])
                    const seekExpectation = expectAsync(
                        controller.seekTo(50)
                    ).toBeRejectedWithError(AbortError)
                    media.dispatchEvent(mockEvent('seeking'))
                    await flushPromises()
                    media.dispatchEvent(mockEvent('emptied'))
                    await seekExpectation
                })

                it('aborts seeks when controller is disposed', async () => {
                    setSeekable([[0, 100]])
                    const seekPromise = controller.seekTo(50)
                    const seekPromise2 = controller.seekTo(100)
                    controller.dispose()
                    await expectAsync(seekPromise).toBeRejectedWithError(
                        AbortError
                    )
                    await expectAsync(seekPromise2).toBeRejectedWithError(
                        AbortError
                    )
                })
            })

            describe('when an error event is emitted', () => {
                describe('and media.error is set', () => {
                    describe('and error is MEDIA_ERR_ABORTED', () => {
                        it('does not report an error', () => {
                            const errorSpy = createEventSpy(controller, 'error')
                            const mediaError = new MockMediaError()
                            mediaError.code = mediaError.MEDIA_ERR_ABORTED
                            mediaError.message = 'Aborted'

                            media.error = mediaError
                            media.dispatchEvent(mockEvent('error'))
                            expect(errorSpy).not.toHaveBeenCalled()
                        })
                    })

                    it('notifies of any playback error encountered', () => {
                        const errorSpy = createEventSpy(controller, 'error')
                        const mediaError = new MockMediaError()
                        mediaError.code = mediaError.MEDIA_ERR_DECODE
                        media.error = mediaError
                        media.dispatchEvent(mockEvent('error'))
                        expect(errorSpy).toHaveBeenCalledOnceWith({
                            target: controller,
                            error: objectContaining({
                                code: mediaError.MEDIA_ERR_DECODE,
                                reason: 'MEDIA_ERR_DECODE',
                                name: 'ReportableMediaError',
                                origin: ErrorOrigin.MEDIA,
                                level: ErrorLevel.FATAL,
                                message:
                                    'An error occurred while trying to decode the media resource.',
                            }),
                        })
                    })
                })
            })

            describe('events', () => {
                it('re-emits unmodified events', () => {
                    const abortSpy = createSpy('abort')
                    controller.on('abort', abortSpy)
                    media.dispatchEvent(mockEvent('abort'))
                    expect(abortSpy).toHaveBeenCalledWith({})

                    const loadedDataSpy = createSpy('loadedData')
                    controller.on('loadedData', loadedDataSpy)
                    media.dispatchEvent(mockEvent('loadeddata'))
                    expect(loadedDataSpy).toHaveBeenCalledWith({})

                    const loadStartSpy = createSpy('loadStart')
                    controller.on('loadStart', loadStartSpy)
                    media.dispatchEvent(mockEvent('loadstart'))
                    expect(loadStartSpy).toHaveBeenCalledWith({})

                    const playSpy = createSpy('play')
                    controller.on('play', playSpy)
                    media.dispatchEvent(mockEvent('play'))
                    expect(playSpy).toHaveBeenCalledWith({})

                    const playingSpy = createSpy('playing')
                    controller.on('playing', playingSpy)
                    media.dispatchEvent(mockEvent('playing'))
                    expect(playingSpy).toHaveBeenCalledWith({})
                    playingSpy.calls.reset()

                    const pauseSpy = createSpy('pause')
                    controller.on('pause', pauseSpy)
                    media.dispatchEvent(mockEvent('pause'))
                    expect(pauseSpy).toHaveBeenCalledWith({})
                    pauseSpy.calls.reset()
                })

                describe('durationChange', () => {
                    it(`emits a change event on media's durationchange`, () => {
                        const durationChangeSpy =
                            createSpy<(e: ChangeEvent<number>) => void>(
                                'durationChange'
                            )
                        controller.on('durationChange', durationChangeSpy)
                        media.duration = 1
                        media.dispatchEvent(mockEvent('durationchange'))
                        expect(durationChangeSpy).toHaveBeenCalledOnceWith({
                            previous: 0,
                            current: 1,
                        })
                        durationChangeSpy.calls.reset()
                        media.duration = 5
                        media.dispatchEvent(mockEvent('durationchange'))
                        expect(durationChangeSpy).toHaveBeenCalledOnceWith({
                            previous: 1,
                            current: 5,
                        })
                    })
                })

                describe('volumeChange', () => {
                    it(`emits a change event on media's volumechange`, () => {
                        const volumeChangeSpy =
                            createSpy<(e: ChangeEvent<number>) => void>(
                                'volumeChange'
                            )
                        controller.on('volumeChange', volumeChangeSpy)
                        controller.volume = 0.3
                        media.dispatchEvent(mockEvent('volumechange'))
                        expect(volumeChangeSpy).toHaveBeenCalledOnceWith({
                            previous: 1.0,
                            current: 0.3,
                        })
                        volumeChangeSpy.calls.reset()
                        controller.volume = 0.2
                        media.dispatchEvent(mockEvent('volumechange'))
                        expect(volumeChangeSpy).toHaveBeenCalledOnceWith({
                            previous: 0.3,
                            current: 0.2,
                        })
                    })
                })

                describe('playing events', () => {
                    it('re-emit and set playing to true', () => {
                        const playingSpy =
                            createSpy<(e: AnyRecord) => void>('playing')
                        controller.on('playing', playingSpy)
                        expect(controller.playing).toBeFalse()
                        media.dispatchEvent(mockEvent('playing'))
                        expect(playingSpy).toHaveBeenCalledOnceWith({})
                        expect(controller.playing).toBeTrue()
                    })
                })

                describe('looped', () => {
                    let loopedSpy: Spy<
                        EventHandler<PlaybackControllerEventMap['looped']>
                    >
                    beforeEach(() => {
                        loopedSpy =
                            createSpy<
                                EventHandler<
                                    PlaybackControllerEventMap['looped']
                                >
                            >('looped')
                        controller.on('looped', loopedSpy)
                    })

                    describe('on Firefox', () => {
                        beforeEach(() => {
                            setUserAgent('Firefox/120.0.0')
                        })

                        it('emits playing event on loop', () => {
                            const playingSpy = createSpy('playing')
                            controller.on('playing', playingSpy)

                            media.loop = true
                            media.paused = false
                            media.duration = 10
                            media.currentTime = 9.5

                            media.dispatchEvent(mockEvent('timeupdate'))
                            media.currentTime = 0
                            media.dispatchEvent(mockEvent('timeupdate'))

                            expect(playingSpy).toHaveBeenCalledOnceWith({})
                        })
                    })

                    describe('when playback seeks from near duration to zero', () => {
                        describe('and loop is true', () => {
                            it('sends out a looped event when necessary', () => {
                                media.loop = true
                                media.paused = false
                                media.duration = 10
                                media.currentTime = 9.5
                                expect(loopedSpy).not.toHaveBeenCalled()
                                media.dispatchEvent(mockEvent('timeupdate'))
                                media.currentTime = 0
                                media.dispatchEvent(mockEvent('timeupdate'))
                                expect(loopedSpy).toHaveBeenCalledTimes(1)
                            })
                        })

                        describe('and loop is false', () => {
                            it('does not broadcast a looped event', () => {
                                media.paused = false
                                media.duration = 10
                                media.currentTime = 9.5
                                expect(loopedSpy).not.toHaveBeenCalled()
                                media.dispatchEvent(mockEvent('timeupdate'))
                                media.currentTime = 0
                                media.dispatchEvent(mockEvent('timeupdate'))
                                expect(loopedSpy).not.toHaveBeenCalled()
                            })
                        })
                    })

                    describe('when playback seeks and is not from end to start', () => {
                        it('does not emit a looped event', () => {
                            media.paused = false
                            media.loop = true
                            media.duration = 10
                            media.currentTime = 7
                            expect(loopedSpy).not.toHaveBeenCalled()
                            media.dispatchEvent(mockEvent('timeupdate'))
                            media.currentTime = 0
                            media.dispatchEvent(mockEvent('seeking'))
                            media.dispatchEvent(mockEvent('seeked'))
                            media.currentTime = 5
                            media.dispatchEvent(mockEvent('seeking'))
                            media.dispatchEvent(mockEvent('seeked'))
                            expect(loopedSpy).not.toHaveBeenCalled()
                        })
                    })

                    describe('when media is paused', () => {
                        it('does not emit a looped event', () => {
                            media.loop = true
                            media.paused = true
                            media.duration = 10
                            media.currentTime = 9.5
                            expect(loopedSpy).not.toHaveBeenCalled()
                            media.dispatchEvent(mockEvent('timeupdate'))
                            media.currentTime = 0
                            media.dispatchEvent(mockEvent('timeupdate'))
                            expect(loopedSpy).not.toHaveBeenCalled()
                        })
                    })
                })

                describe('mutedChange', () => {
                    describe('after an volumechange event', () => {
                        it('emits immediately if muted status has changed', () => {
                            const spy =
                                createSpy<EventHandler<ChangeEvent<boolean>>>(
                                    'mutedChange'
                                )
                            controller.on('mutedChange', spy)
                            media.muted = false
                            media.dispatchEvent(mockEvent('volumechange'))
                            expect(spy).not.toHaveBeenCalled()
                            media.muted = true
                            media.dispatchEvent(mockEvent('volumechange'))
                            expect(spy).toHaveBeenCalledOnceWith({
                                previous: false,
                                current: true,
                            })
                        })

                        it('checks after an interval if mute remains unchanged', async () => {
                            const spy =
                                createSpy<EventHandler<ChangeEvent<boolean>>>(
                                    'mutedChange'
                                )
                            controller.on('mutedChange', spy)
                            media.muted = false
                            media.dispatchEvent(mockEvent('volumechange'))
                            await clock.tick(0)
                            expect(spy).not.toHaveBeenCalled()
                            media.dispatchEvent(mockEvent('volumechange'))
                            media.muted = true
                            await clock.tick(0.2)
                            expect(spy).toHaveBeenCalledOnceWith({
                                previous: false,
                                current: true,
                            })
                        })
                    })

                    describe('when disposed', () => {
                        it('avoids dispatching a mutedChange event without cause', async () => {
                            const spy =
                                createSpy<EventHandler<ChangeEvent<boolean>>>(
                                    'mutedChange'
                                )
                            controller.on('mutedChange', spy)
                            media.dispatchEvent(mockEvent('volumechange'))
                            media.muted = true
                            controller.dispose()
                            await clock.tick(0)
                            expect(spy).not.toHaveBeenCalled()
                        })
                    })
                })

                describe('played', () => {
                    it('triggers event following any cessation of playback', () => {
                        const playedSpy =
                            createSpy<
                                EventHandler<
                                    PlaybackControllerEventMap['played']
                                >
                            >('played')
                        controller.on('played', playedSpy)

                        expect(controller.playing).toBeFalse()
                        media.dispatchEvent(mockEvent('seeking'))
                        media.dispatchEvent(mockEvent('seeked'))
                        expect(controller.playing).toBeFalse()
                        expect(playedSpy).not.toHaveBeenCalled()
                        clock.mockDate(new Date(11_000))
                        media.currentTime = 10
                        media.dispatchEvent(mockEvent('playing'))
                        expect(controller.playing).toBeTrue()
                        expect(playedSpy).not.toHaveBeenCalled()
                        clock.mockDate(new Date(60_000))
                        media.currentTime = 30
                        media.dispatchEvent(mockEvent('seeking'))
                        expect(playedSpy).toHaveBeenCalledOnceWith({
                            started: 11_000,
                            ended: 60_000,
                            duration: 49,
                            reason: PlayedReason.SEEKING,
                            playbackTime: 20,
                        })
                        playedSpy.calls.reset()
                        media.dispatchEvent(mockEvent('seeked'))
                        expect(controller.playing).toBeFalse()
                        clock.mockDate(new Date(13_000))
                        media.currentTime = 40
                        media.dispatchEvent(mockEvent('playing'))
                        expect(controller.playing).toBeTrue()
                        expect(playedSpy).not.toHaveBeenCalled()
                        clock.mockDate(new Date(17_000))
                        media.currentTime = 53
                        media.dispatchEvent(mockEvent('ended'))
                        expect(playedSpy).toHaveBeenCalledOnceWith({
                            started: 13_000,
                            ended: 17_000,
                            duration: 4,
                            reason: PlayedReason.ENDED,
                            playbackTime: 13,
                        })
                        expect(controller.playing).toBeFalse()
                    })

                    describe('when not playing', () => {
                        it('prevents duplicate played events from being emitted', () => {
                            const playedSpy =
                                createSpy<
                                    EventHandler<
                                        PlaybackControllerEventMap['played']
                                    >
                                >('played')
                            controller.on('played', playedSpy)

                            media.dispatchEvent(mockEvent('playing'))
                            expect(playedSpy).not.toHaveBeenCalled()
                            media.dispatchEvent(mockEvent('seeking'))
                            expect(playedSpy).toHaveBeenCalledTimes(1)
                            playedSpy.calls.reset()
                            media.dispatchEvent(mockEvent('seeking'))
                            media.dispatchEvent(mockEvent('seeking'))
                            expect(playedSpy).not.toHaveBeenCalled()
                            media.dispatchEvent(mockEvent('playing'))
                            media.dispatchEvent(mockEvent('pause'))
                            expect(playedSpy).toHaveBeenCalledTimes(1)
                            playedSpy.calls.reset()
                            media.dispatchEvent(mockEvent('pause'))
                            media.dispatchEvent(mockEvent('pause'))
                            expect(playedSpy).not.toHaveBeenCalled()
                        })
                    })
                })

                describe('progress', () => {
                    class MockProgressEvent extends MockEvent {
                        constructor(
                            public type: string,
                            readonly loaded: number,
                            readonly total: number
                        ) {
                            super()
                            this.type = type
                        }
                    }

                    it(`emits updates on media's progress consistently`, () => {
                        const progressSpy =
                            createSpy<(e: ProgressEvent) => void>('progress')
                        controller.on('progress', progressSpy)
                        media.dispatchEvent(
                            new MockProgressEvent('progress', 5, 12)
                        )
                        expect(progressSpy).toHaveBeenCalledOnceWith({
                            loaded: 5,
                            total: 12,
                        })
                    })
                })

                describe('rateChange', () => {
                    it(`emits a change event on media's ratechange`, () => {
                        const rateChangeSpy =
                            createSpy<(e: ChangeEvent<number>) => void>(
                                'rateChange'
                            )
                        controller.on('rateChange', rateChangeSpy)
                        media.playbackRate = 0.3
                        media.dispatchEvent(mockEvent('ratechange'))
                        expect(rateChangeSpy).toHaveBeenCalledOnceWith({
                            previous: 0,
                            current: 0.3,
                        })
                        rateChangeSpy.calls.reset()
                        media.playbackRate = 0.2
                        media.dispatchEvent(mockEvent('ratechange'))
                        expect(rateChangeSpy).toHaveBeenCalledOnceWith({
                            previous: 0.3,
                            current: 0.2,
                        })
                    })
                })

                describe('seeking', () => {
                    it('returns true in the interim between seeking and seeked', () => {
                        expect(controller.seeking).toBeFalse()
                        media.dispatchEvent(mockEvent('seeking'))
                        expect(controller.seeking).toBeTrue()
                        media.dispatchEvent(mockEvent('seeked'))
                        expect(controller.seeking).toBeFalse()
                    })
                })

                describe('seeked', () => {
                    it(`announces media's seeked events with the seek duration`, () => {
                        const seekedSpy = createEventSpy(controller, 'seeked')
                        clock.mockDate(new Date(10_000))
                        media.dispatchEvent(mockEvent('seeking'))
                        clock.mockDate(new Date(60_000))
                        expect(seekedSpy).not.toHaveBeenCalled()
                        media.dispatchEvent(mockEvent('seeked'))
                        expect(seekedSpy).toHaveBeenCalledOnceWith({
                            started: 10_000,
                            ended: 60_000,
                            duration: 50,
                            reason: 'seeked',
                        })
                    })

                    it('avoids emitting if a seeked action occurred without a preceding seeking', () => {
                        // Can happen if the media element was already seeking when the player was
                        // created
                        const seekedSpy = createEventSpy(controller, 'seeked')
                        media.dispatchEvent(mockEvent('seeked'))
                        expect(seekedSpy).not.toHaveBeenCalled()
                    })
                })

                describe('timeUpdate', () => {
                    it(`emits a change event on media's timeupdate`, () => {
                        const timeUpdateSpy =
                            createSpy<(e: ChangeEvent<number>) => void>(
                                'timeUpdate'
                            )
                        controller.on('timeUpdate', timeUpdateSpy)
                        media.currentTime = 1
                        media.dispatchEvent(mockEvent('timeupdate'))
                        expect(timeUpdateSpy).toHaveBeenCalledOnceWith({
                            previous: 0,
                            current: 1,
                        })
                        timeUpdateSpy.calls.reset()
                        media.currentTime = 5
                        media.dispatchEvent(mockEvent('timeupdate'))
                        expect(timeUpdateSpy).toHaveBeenCalledOnceWith({
                            previous: 1,
                            current: 5,
                        })
                    })
                })

                describe('waited', () => {
                    it('triggers event after a specified wait completes', () => {
                        expect(controller.waiting).toBeFalse()
                        const waitedSpy =
                            createSpy<
                                EventHandler<
                                    PlaybackControllerEventMap['waited']
                                >
                            >('waited')
                        controller.on('waited', waitedSpy)
                        media.dispatchEvent(mockEvent('playing'))
                        media.dispatchEvent(mockEvent('seeking'))
                        media.dispatchEvent(mockEvent('seeked'))
                        expect(waitedSpy).not.toHaveBeenCalled()
                        clock.mockDate(new Date(10_000))
                        media.dispatchEvent(mockEvent('waiting'))
                        expect(controller.waiting).toBeTrue()
                        expect(waitedSpy).not.toHaveBeenCalled()
                        clock.mockDate(new Date(60_000))
                        media.dispatchEvent(mockEvent('seeking'))
                        expect(waitedSpy).toHaveBeenCalledOnceWith({
                            started: 10_000,
                            ended: 60_000,
                            duration: 50,
                            reason: WaitedReason.SEEKING,
                        })
                        waitedSpy.calls.reset()
                        media.dispatchEvent(mockEvent('seeking'))
                        expect(waitedSpy).not.toHaveBeenCalled()
                        media.dispatchEvent(mockEvent('waiting'))
                        expect(controller.waiting).toBeTrue()
                        media.dispatchEvent(mockEvent('emptied'))
                        expect(controller.waiting).toBeFalse()
                        expect(waitedSpy).toHaveBeenCalledOnceWith(
                            objectContaining({
                                reason: 'emptied',
                            })
                        )
                        waitedSpy.calls.reset()

                        media.dispatchEvent(mockEvent('waiting'))
                        expect(controller.waiting).toBeTrue()
                        media.dispatchEvent(mockEvent('pause'))
                        expect(controller.waiting).toBeFalse()
                        expect(waitedSpy).toHaveBeenCalledOnceWith(
                            objectContaining({
                                reason: 'pause',
                            })
                        )
                        waitedSpy.calls.reset()

                        // When not in a waiting state, don't emit waited
                        media.dispatchEvent(mockEvent('pause'))
                        expect(waitedSpy).not.toHaveBeenCalled()
                    })
                })
            })

            describe('pause', () => {
                it('invokes pause on the element', () => {
                    expect(media.pause).not.toHaveBeenCalled()
                    controller.pause()
                    expect(media.pause).toHaveBeenCalledTimes(1)
                })

                describe('when a play is pending', () => {
                    it('aborts the play request', async () => {
                        const promise = controller.play()
                        expect(controller.playIsPending).toBeTrue()
                        controller.pause()
                        await expectAsync(promise).toBeRejectedWith(
                            objectContaining({
                                name: 'AbortError',
                                message: any(String),
                            })
                        )
                        expect(controller.playIsPending).toBeFalse()
                    })
                })

                it('resets the pending play', async () => {
                    const promise1 = controller.play()
                    await expectAsync(promise1).toBePending()
                    expect(promise1).toBe(controller.play())
                    controller.pause()
                    await expectAsync(promise1).toBeRejected()
                    const promise2 = controller.play()
                    await expectAsync(promise2).toBePending()
                    expect(promise2).not.toBe(promise1)
                    controller.pause()
                    await expectAsync(promise2).toBeRejected()
                })
            })

            describe('play', () => {
                describe('when metadata is not loaded', () => {
                    it('waits for metadata before play is invoked', async () => {
                        media.play.and.returnValue(Promise.resolve())
                        const playPromise = controller.play()
                        await expectAsync(playPromise).toBePending()
                        expect(media.play).not.toHaveBeenCalled()
                        media.readyState = PlaybackReadyState.HAVE_METADATA
                        media.dispatchEvent(mockEvent('loadedmetadata'))
                        await expectAsync(playPromise).toBeResolved()
                    })

                    describe('and play is called again', () => {
                        it('returns the same pending play promise', () => {
                            const playPromise = controller.play()
                            const playPromise2 = controller.play()
                            expect(playPromise).toBe(playPromise2)
                        })
                    })
                })

                describe('when media.play rejects', () => {
                    it('emits playRejection event', async () => {
                        media.readyState = PlaybackReadyState.HAVE_METADATA
                        const playRejectionSpy = createSpy('playRejection')
                        controller.on('playRejected', playRejectionSpy)
                        await controller.play()
                        await clock.tick()
                        expect(playRejectionSpy).not.toHaveBeenCalled()

                        const error = new Error('rejected')
                        media.play.and.returnValue(Promise.reject(error))
                        await controller.play().catch((_) => {})
                        await clock.tick()
                        expect(playRejectionSpy).toHaveBeenCalledOnceWith({
                            reason: error,
                        })
                    })
                })
            })

            describe('duration', () => {
                it('returns media.duration', () => {
                    media.duration = 42
                    expect(controller.duration).toBe(42)
                })

                describe('when media.duration is at least LIVE_DURATION', () => {
                    it('returns Number.POSITIVE_INFINITY', () => {
                        media.duration = LIVE_DURATION
                        expect(controller.duration).toBe(
                            Number.POSITIVE_INFINITY
                        )
                    })
                })
            })

            describe('currentTimePercent', () => {
                it('returns the current time as a percent of duration', () => {
                    expect(controller.currentTimePercent).toBe(0)
                    media.currentTime = 50
                    media.duration = 100
                    expect(controller.currentTimePercent).toEqual(0.5)
                    media.duration = Number.NaN
                    expect(controller.currentTimePercent).toBe(0)
                })
            })
        })

        describe('reset', () => {
            let controller: PlaybackControllerImpl
            beforeEach(() => {
                controller = new PlaybackControllerImpl({
                    media,
                    loudnessNormalizationController,
                })
            })

            it('does nothing when there is no error', () => {
                expect(controller.error).toBeNull()
                const resetSpy = createEventSpy(controller, 'reset')
                controller.reset()
                expect(resetSpy).not.toHaveBeenCalled()
                expect(controller.error).toBeNull()
            })

            it('clears error and emits a reset event', () => {
                // Set up an error state by triggering media error
                const mockError = new MockMediaError()
                mockError.code = 2
                media.error = mockError
                media.dispatchEvent(mockEvent('error'))
                expect(controller.error).not.toBeNull()

                const resetSpy = createEventSpy(controller, 'reset')
                controller.reset()
                expect(resetSpy).toHaveBeenCalledTimes(1)

                expect(controller.error).toBeNull()
            })
        })
    })

    describe('minSeekableBuffer default', () => {
        function testForUa(userAgent: string, expected: number) {
            setUserAgent(userAgent)
            expect(
                new PlaybackControllerImpl({
                    media: new MockHTMLAudioElement(),
                    loudnessNormalizationController:
                        new MockLoudnessNormalizationController(),
                }).options.minSeekableBuffer
            )
                .withContext(`minSeekableBuffer`)
                .toEqual(expected)
        }

        it('is 2 for Chromium, and Edge Chromium browsers', () => {
            testForUa('Chrome/120 Edg/120', 2)
            testForUa('Chrome/53.1.2', 2)
            testForUa('Chrome/120.0.0', 2)
        })

        it('is 5 for Edge Legacy, Firefox and Safari', () => {
            testForUa('Edge/18.0.0', 5)
            testForUa('Version/17.0.0 Safari', 5)
            testForUa('Firefox/53.1.2', 5)
            testForUa('Firefox/120.0.0', 5)
        })
    })

    describe('isNotAllowedError', () => {
        it('identifies a DOMException named NotAllowedError as true', () => {
            expect(isNotAllowedError(notAllowedError)).toBeTrue()
            expect(isNotAllowedError(notAuthorizedError)).toBeFalse()
            expect(isNotAllowedError(undefined)).toBeFalse()
        })
    })
})
