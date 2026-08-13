/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type AdBreakList,
    type ContentType,
    type SeekRange,
    type StreamingEventMap,
    TrackBase,
    type TrackBaseDeps,
    trackConfigOptionsValidator,
    type TrackUri,
} from '@amazon/vinyl'
import {
    Abort,
    createShortUid,
    DisposedError,
    type ReadonlyAbort,
} from '@amazon/vinyl-util'
import {
    MockDrmController,
    MockPlaybackController,
} from '@amazon/vinyl/vinylTestUtil'
import { createEventSpy, type EventSpy } from '@amazon/vinyl-util/testUtil'
import createSpy = jasmine.createSpy
import objectContaining = jasmine.objectContaining
import any = jasmine.any

describe('TrackBase', () => {
    class TestTrackBase extends TrackBase {
        constructor(id: TrackUri, deps: TrackBaseDeps) {
            super(id, 'test', deps)
        }
        contentTypes = new Set<ContentType>()
        qualities = null
        qualitiesUnfiltered = null
        getStreamingQuality = createSpy('getStreamingQuality').and.returnValue(
            null
        )
        getBufferingQuality = createSpy('getBufferingQuality').and.returnValue(
            null
        )
        getPlaybackQuality =
            createSpy('getPlaybackQuality').and.returnValue(null)
        clearPrefetch = createSpy()
        onActivated = createSpy()
        onDeactivated = createSpy()

        getDrmSessionAbort(): ReadonlyAbort {
            return this.drmSessionAbort.value
        }

        simulateError(error: Error) {
            this.errorHandler(error)
        }

        simulateSetAdBreaks(value: AdBreakList | null) {
            this.setAdBreaks(value)
        }

        simulateSetSeekRange(value: SeekRange) {
            this.setSeekRange(value)
        }
    }

    let track: TestTrackBase
    let playbackController: MockPlaybackController
    let drmController: MockDrmController

    function createTrack(id?: string): TestTrackBase {
        return new TestTrackBase(id ?? createShortUid(), {
            playbackController,
            drmController,
        })
    }

    beforeEach(() => {
        drmController = new MockDrmController()
        playbackController = new MockPlaybackController()
        playbackController.seekTo.and.resolveTo(void 0)
        track = createTrack()
    })

    describe('id', () => {
        it('returns the id', () => {
            track = createTrack('example')
            expect(track.uri).toBe('example')
        })
    })

    describe('fetchedRanges', () => {
        it('is empty ranges', () => {
            expect(track.fetchedRanges).toEqual(
                objectContaining({ ranges: [] })
            )
        })
    })

    describe('activate', () => {
        describe('when track is not active', () => {
            it('seeks to track.startTime', () => {
                track.activate({ startTime: 44 })
                expect(playbackController.seekTo).toHaveBeenCalledOnceWith(44)
                playbackController.seekTo.calls.reset()
                track.deactivate()
                track.activate({ startTime: 55 })
                expect(playbackController.seekTo).toHaveBeenCalledOnceWith(55)
            })

            it('calls onActivated', () => {
                track.activate({ startTime: 23 })
                expect(track.onActivated).toHaveBeenCalledOnceWith({
                    startTime: 23,
                })
            })

            it('changes isActive state', () => {
                expect(track.active).toBeFalse()
                track.activate({})
                expect(track.active).toBeTrue()
            })
        })

        describe('when track is already active', () => {
            beforeEach(() => {
                track.activate({})
                track.onActivated.calls.reset()
            })

            it('does nothing', () => {
                track.activate({})
                expect(track.onActivated.calls.count()).toEqual(0)
            })
        })
    })

    describe('deactivate', () => {
        describe('when track is active', () => {
            beforeEach(() => {
                track.activate({})
            })

            it('calls onDeactivated', () => {
                track.deactivate()
                expect(track.onDeactivated).toHaveBeenCalledOnceWith()
            })

            it('aborts open drm sessions', () => {
                const sessionAbort = track.getDrmSessionAbort()
                track.deactivate()
                expect(sessionAbort.aborted()).toBeTrue()
                expect(track.getDrmSessionAbort()).toEqual(any(Abort))
                expect(track.getDrmSessionAbort()).not.toBe(sessionAbort)
            })
        })

        describe('when track is not active', () => {
            it('does nothing', () => {
                track.deactivate()
                expect(track.onDeactivated).not.toHaveBeenCalled()
            })
        })
    })

    describe('extra', () => {
        it('returns the load options extra when active', () => {
            track.preload({ prefetchPriority: 2 }, { extra: 42 })
            expect(track.extra).toBeNull()
            track.activate({ extra: 42 })
            expect(track.extra).toBe(42)
            track.deactivate()
            expect(track.extra).toBeNull()
        })
    })

    describe('toString', () => {
        it('contains the id', () => {
            expect(track.toString()).toContain(track.uri)
            expect(track.toString()).toContain('TrackBase')
        })
    })

    describe('disposed', () => {
        it('is true when the track is disposed', () => {
            expect(track.disposed).toBeFalse()
            track.dispose()
            expect(track.disposed).toBeTrue()
        })
    })

    describe('dispose', () => {
        describe('when already disposed', () => {
            it('throws a DisposedError', () => {
                track.dispose()
                expect(() => track.dispose()).toThrowMatching(
                    (e) => e instanceof DisposedError
                )
            })
        })

        describe('when active', () => {
            it('deactivates', () => {
                track.activate({})
                track.dispose()
                expect(track.active).toBeFalse()
            })
        })
    })

    describe('trackConfigOptionsValidator', () => {
        it('validates the track config options shape', () => {
            expect(
                trackConfigOptionsValidator.isValid({
                    startTime: 44,
                    extra: {},
                })
            ).toBeTrue()

            expect(
                trackConfigOptionsValidator.isValid({
                    startTime: '44',
                    extra: {},
                })
            ).toBeFalse()
        })
    })

    describe('error', () => {
        it('returns the last handled error', () => {
            expect(track.error).toBeNull()
            const error = new Error('expected')
            track.simulateError(error)
            expect(track.error).toBe(error)
            track.simulateError(new Error('ignored'))
            expect(track.error).toBe(error)
        })
    })

    describe('errorHandler', () => {
        it('sets error and emits an error event when not in an error state', () => {
            const error = new Error('expected')
            const errorSpy = createEventSpy(track, 'error')
            track.simulateError(error)
            expect(errorSpy).toHaveBeenCalledOnceWith({
                error,
                target: track,
            })
        })
    })

    describe('setAdBreaks', () => {
        it('does not re-emit adsChange when the ad breaks are unchanged', () => {
            const adBreaks: AdBreakList = []
            track.simulateSetAdBreaks(adBreaks)
            const adsSpy = createEventSpy(track, 'adsChange')
            track.simulateSetAdBreaks([])
            expect(adsSpy).not.toHaveBeenCalled()
        })
    })

    describe('setSeekRange', () => {
        it('does not re-emit seekRangeChange when the range is unchanged', () => {
            track.simulateSetSeekRange({ start: 0, end: 60 })
            const seekRangeSpy = createEventSpy(track, 'seekRangeChange')
            track.simulateSetSeekRange({ start: 0, end: 60 })
            expect(seekRangeSpy).not.toHaveBeenCalled()
        })
    })

    describe('reset', () => {
        let resetSpy: EventSpy<StreamingEventMap, 'reset'>

        beforeEach(() => {
            resetSpy = createEventSpy(track, 'reset')
        })

        it('does nothing if not in an error state', () => {
            track.reset()
            expect(resetSpy).not.toHaveBeenCalled()
        })

        it('resets error state and emits a reset event', () => {
            const error = new Error('expected')
            track.simulateError(error)
            expect(track.error).toBe(error)
            track.reset()
            expect(track.error).toBeNull()
            expect(resetSpy).toHaveBeenCalledOnceWith({})
        })

        describe('hard reset of an active track', () => {
            beforeEach(() => {
                playbackController.play.and.resolveTo(void 0)
                track.activate({ startTime: 5 })
                // Clear calls captured during activate so assertions only
                // observe the reset behavior.
                track.onActivated.calls.reset()
                track.onDeactivated.calls.reset()
                track.clearPrefetch.calls.reset()
                playbackController.seekTo.calls.reset()
            })

            it('deactivates, activates, and restores the playback time', () => {
                playbackController.currentTime = 42
                track.reset(true)
                expect(track.onDeactivated).toHaveBeenCalledOnceWith()
                expect(track.clearPrefetch).toHaveBeenCalledOnceWith()
                expect(track.onActivated).toHaveBeenCalledOnceWith({
                    startTime: 5,
                })
                expect(playbackController.seekTo).toHaveBeenCalledOnceWith(42)
                expect(resetSpy).toHaveBeenCalledOnceWith({})
            })

            it('resumes playback when it was not paused', () => {
                playbackController.paused = false
                playbackController.ended = false
                track.reset(true)
                expect(playbackController.play).toHaveBeenCalledOnceWith()
            })

            it('does not resume playback when it was paused', () => {
                playbackController.paused = true
                track.reset(true)
                expect(playbackController.play).not.toHaveBeenCalled()
            })
        })
    })
})
