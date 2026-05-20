/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type ContentType,
    createEmptyMediaQualityMetadata,
    createSourceTrackFactory,
    createTrackFactory,
    createVinylPlayer,
    defaultQualitySelectorImplOptions,
    DrmError,
    type MediaQualityMetadata,
    type PlaybackController,
    PlaybackNetworkState,
    PlaybackReadyState,
    type SourceTrackDeps,
    type SourceTrackLoadOptions,
    type VinylDependencyOptions,
    type VinylDeps,
    vinylGlobalRef,
    type VinylPlayer,
    type VinylTrackLoadOptions,
} from '@amazon/vinyl'
import { externalDependencies, type Factories } from '@amazon/vinyl-di'
import {
    consoleLogHandler,
    createArrayLikeIterator,
    emptyRanges,
    historyLogHandler,
    noop,
    RangesImpl,
} from '@amazon/vinyl-util'
import {
    expectIterableEquals,
    expectNothing,
    expectTypeStrictlyEquals,
    mockEvent,
    MockHTMLAudioElement,
    polyfillCustomEvent,
} from '@amazon/vinyl-util/browserTestUtil'
import {
    createMockVinylDependencies,
    MockCapabilities,
    MockPlaybackController,
    MockTrack,
    MockTrackController,
    MockTrackFactory,
    type MockVinylDependencies,
} from '@amazon/vinyl/vinylTestUtil'
import { createEventSpy } from '@amazon/vinyl-util/testUtil'
import { data } from '@amazon/vinyl-observable'
import any = jasmine.any
import createSpy = jasmine.createSpy

describe('VinylPlayer', () => {
    let deps: MockVinylDependencies
    let depFactories: Factories<VinylDeps>
    let player: VinylPlayer
    let mockOptions: VinylDependencyOptions

    polyfillCustomEvent()

    beforeEach(() => {
        mockOptions = { media: new MockHTMLAudioElement() }
        deps = createMockVinylDependencies()
        depFactories = externalDependencies(deps)
        player = createVinylPlayer(mockOptions, depFactories)
    })

    afterEach(() => {
        player.dispose()
    })

    describe('capabilities', () => {
        it('returns the capabilities impl', () => {
            expect(player.capabilities).toBeInstanceOf(MockCapabilities)
        })
    })

    it('delegates the PlaybackController api', () => {
        const playbackController = deps.playbackController
        playbackController.seekTo.and.resolveTo(void 0)

        expect(player.buffered).toBe(playbackController.buffered)
        playbackController.canPlay = true
        expect(player.canPlay).toBe(true)
        playbackController.canPlayThrough = true
        expect(player.canPlayThrough).toBe(true)
        playbackController.currentTime = 10
        expect(player.currentTime).toBe(10)
        playbackController.currentTimePercent = 0.1
        expect(player.currentTimePercent).toBe(0.1)
        playbackController.defaultPlaybackRate = 0.5
        expect(player.defaultPlaybackRate).toBe(0.5)
        player.defaultPlaybackRate = 1.5
        expect(playbackController.defaultPlaybackRate).toBe(1.5)
        playbackController.currentTime = 20
        expect(playbackController.currentTime).toBe(20)
        playbackController.duration = 30
        expect(player.duration).toBe(30)
        playbackController.ended = true
        expect(player.ended).toBeTrue()
        expect(player.error).toBeNull()
        playbackController.hasMetadata = true
        expect(player.hasMetadata).toBeTrue()
        playbackController.playIsPending = true
        expect(player.playIsPending).toBeTrue()

        playbackController.loop = true
        expect(player.loop).toBeTrue()
        player.loop = false
        expect(playbackController.loop).toBeFalse()

        playbackController.muted = true
        expect(player.muted).toBeTrue()
        player.muted = false
        expect(playbackController.muted).toBeFalse()

        playbackController.networkState = PlaybackNetworkState.NETWORK_LOADING
        expect(player.networkState).toBe(PlaybackNetworkState.NETWORK_LOADING)

        playbackController.paused = true
        expect(player.paused).toBeTrue()

        playbackController.playbackRate = 0.5
        expect(player.playbackRate).toBe(0.5)
        player.playbackRate = 1.5
        expect(playbackController.playbackRate).toBe(1.5)

        playbackController.playing = true
        expect(player.playing).toBeTrue()

        playbackController.preservesPitch = false
        expect(player.preservesPitch).toBe(false)
        player.preservesPitch = true
        expect(playbackController.preservesPitch).toBe(true)

        playbackController.readyState = PlaybackReadyState.HAVE_FUTURE_DATA
        expect(player.readyState).toBe(PlaybackReadyState.HAVE_FUTURE_DATA)

        const mT = new RangesImpl()
        playbackController.seekable = mT
        expect(player.seekable).toBe(mT)

        playbackController.seeking = true
        expect(player.seeking).toBeTrue()

        playbackController.volume = 0.5
        expect(player.volume).toBe(0.5)
        player.volume = 1.0
        expect(playbackController.volume).toBe(1.0)

        playbackController.waiting = true
        expect(player.waiting).toBeTrue()

        expect(playbackController.pause).not.toHaveBeenCalled()
        player.pause()
        expect(playbackController.pause).toHaveBeenCalledOnceWith()

        expect(playbackController.play).not.toHaveBeenCalled()
        const playPromise = Promise.resolve()
        playbackController.play.and.returnValue(playPromise)
        expect(player.play()).toBe(playPromise)
        expect(playbackController.play).toHaveBeenCalledOnceWith()

        player.seekTo(3).catch(noop)
        expect(playbackController.seekTo).toHaveBeenCalledOnceWith(3, undefined)
    })

    it('delegates the TrackController api', () => {
        const trackController = deps.trackController

        const tracks: VinylTrackLoadOptions[] = [
            { type: 'src', uri: '1' },
            { type: 'src', uri: '2' },
        ]
        player.load(...tracks)
        expect(trackController.load).toHaveBeenCalledOnceWith(...tracks)

        player.enqueue(...tracks)
        expect(trackController.enqueue).toHaveBeenCalledOnceWith(...tracks)

        player.preload(...tracks)
        expect(trackController.preload).toHaveBeenCalledOnceWith(...tracks)

        player.unload()
        expect(trackController.unload).toHaveBeenCalledOnceWith()

        trackController.hasNext.and.returnValue(true)
        expect(player.hasNext()).toBeTrue()

        trackController.isTrackCached.and.returnValue(true)
        expect(player.isTrackCached('1')).toBeTrue()

        const mockTrack = new MockTrack()
        trackController.getCachedTrack.and.returnValue(mockTrack)
        expect(player.getCachedTrack('1')).toBe(mockTrack)

        trackController.getCachedTracks.and.returnValue(
            createArrayLikeIterator([mockTrack])
        )
        expectIterableEquals(player.getCachedTracks(), [mockTrack])

        player.next()
        expect(trackController.next).toHaveBeenCalledOnceWith()

        player.clearPrefetch()
        expect(trackController.clearPrefetch).toHaveBeenCalledOnceWith()

        player.clearTrackCache()
        expect(trackController.clearTrackCache).toHaveBeenCalledOnceWith()

        player.clearQueue()
        expect(trackController.clearQueue).toHaveBeenCalledOnceWith()

        trackController.queue = [{ uri: 'a' }, { uri: 'b' }]
        expect(player.queue).toEqual(trackController.queue)
    })

    it('re-dispatches events from the playback controller', () => {
        // redispatchEvents is tested; this is a smoke test to ensure that redispatchEvents was
        // called.
        const spy = createSpy('play')
        player.on('play', spy)
        const pC = deps.playbackController
        const event = mockEvent('play')
        pC.dispatch('play', event)
        expect(spy).toHaveBeenCalledOnceWith(event)
    })

    it('re-dispatches currentTrackChange from the track controller', () => {
        const spy = createSpy('currentTrackChange')
        player.on('currentTrackChange', spy)
        const trackController = deps.trackController
        const mockTrackA = new MockTrack()
        const mockTrackB = new MockTrack()

        trackController.dispatch('currentTrackChange', {
            previous: mockTrackA,
            current: mockTrackB,
        })
        expect(spy).toHaveBeenCalledOnceWith({
            previous: mockTrackA,
            current: mockTrackB,
        })
        spy.calls.reset()
        trackController.dispatch('currentTrackChange', {
            previous: mockTrackB,
            current: null,
        })
        expect(spy).toHaveBeenCalledOnceWith({
            previous: mockTrackB,
            current: null,
        })
    })

    describe('currentTrack', () => {
        it('returns the currently active track', () => {
            expect(player.currentTrack).toBeNull()
            const mockTrackA = new MockTrack()
            mockTrackA.uri = 'srcA'
            const mockTrackB = new MockTrack()
            mockTrackB.uri = 'srcB'
            expect(player.currentTrack).toBeNull()
            deps.trackController.currentTrack = mockTrackA
            expect(player.currentTrack).toBe(mockTrackA)
            deps.trackController.currentTrack = mockTrackB
            expect(player.currentTrack).toBe(mockTrackB)
        })
    })

    describe('fetchedRanges', () => {
        it('returns the fetched ranges of the current track', () => {
            expect(player.fetchedRanges).toEqual(emptyRanges)
            const mockTrackA = new MockTrack()
            const expectedRanges = new RangesImpl([[0, 10]])
            mockTrackA.fetchedRanges = expectedRanges
            deps.trackController.currentTrack = mockTrackA
            expect(player.fetchedRanges).toEqual(expectedRanges)
        })
    })

    describe('fetchedTime', () => {
        it('returns the time of the prefetch end', () => {
            expect(player.fetchedTime).toBe(0)
            const mockTrackA = new MockTrack()
            mockTrackA.fetchedRanges = new RangesImpl([
                [0, 10],
                [30, 60],
            ])
            deps.trackController.currentTrack = mockTrackA
            expect(player.fetchedTime).toEqual(10)
            deps.playbackController.currentTime = 6
            expect(player.fetchedTime).toEqual(10)
            deps.playbackController.currentTime = 30
            expect(player.fetchedTime).toEqual(60)
            deps.playbackController.currentTime = 55
            expect(player.fetchedTime).toEqual(60)
        })
    })

    describe('fetchedTimePercent', () => {
        it('returns the fetched time as a percent of duration', () => {
            expect(player.fetchedTimePercent).toBe(0)
            const mockTrackA = new MockTrack()
            mockTrackA.fetchedRanges = new RangesImpl([[0, 50]])
            deps.trackController.currentTrack = mockTrackA
            deps.playbackController.duration = 100
            expect(player.fetchedTimePercent).toEqual(0.5)
            deps.playbackController.duration = Number.NaN
            expect(player.fetchedTimePercent).toEqual(0)
        })
    })

    describe('when the current track dispatches fetchedRanges', () => {
        it('the player re-dispatches the event', () => {
            const fetchedRangesChangeSpy = createEventSpy(
                player,
                'fetchedRangesChange'
            )

            const mockTrackA = new MockTrack()
            const event = {}
            mockTrackA.dispatch('fetchedRangesChange', event)
            expect(fetchedRangesChangeSpy).not.toHaveBeenCalled()

            deps.trackController.dispatch('currentTrackChange', {
                previous: null,
                current: mockTrackA,
            })
            expect(fetchedRangesChangeSpy).toHaveBeenCalledOnceWith(event) // Emitted on track change
            fetchedRangesChangeSpy.calls.reset()

            mockTrackA.dispatch('fetchedRangesChange', event)
            expect(fetchedRangesChangeSpy).toHaveBeenCalledOnceWith(event)
            fetchedRangesChangeSpy.calls.reset()

            deps.trackController.dispatch('currentTrackChange', {
                previous: mockTrackA,
                current: null,
            })
            expect(fetchedRangesChangeSpy).toHaveBeenCalledOnceWith(event) // Emitted on track change
            fetchedRangesChangeSpy.calls.reset()

            // Inactive track events should not be re-dispatched:
            mockTrackA.dispatch('fetchedRangesChange', event)
            expect(fetchedRangesChangeSpy).not.toHaveBeenCalled()
        })
    })

    describe('quality accessors', () => {
        it('returns the qualities of the current track', () => {
            expect(player.getPlaybackQuality('audio')).toBeNull()
            expect(player.getStreamingQuality('audio')).toBeNull()
            expect(player.getBufferingQuality('audio')).toBeNull()
            const mockTrackA = new MockTrack()
            const streamingQuality: MediaQualityMetadata = {
                ...createEmptyMediaQualityMetadata(),
                qualityId: 'a',
            }
            const bufferingQuality: MediaQualityMetadata = {
                ...createEmptyMediaQualityMetadata(),
                qualityId: 'b',
            }
            const playbackQuality: MediaQualityMetadata = {
                ...createEmptyMediaQualityMetadata(),
                qualityId: 'c',
            }

            mockTrackA.getStreamingQuality.and.returnValue(streamingQuality)
            mockTrackA.getBufferingQuality.and.returnValue(bufferingQuality)
            mockTrackA.getPlaybackQuality.and.returnValue(playbackQuality)
            deps.trackController.currentTrack = mockTrackA
            expect(player.getStreamingQuality('audio')).toEqual(
                streamingQuality
            )
            expect(player.getBufferingQuality('audio')).toEqual(
                bufferingQuality
            )
            expect(player.getPlaybackQuality('audio')).toEqual(playbackQuality)
        })

        it('returns content types from current track', () => {
            expect(player.contentTypes).toEqual(new Set())
            const mockTrackA = new MockTrack()
            mockTrackA.contentTypes = new Set(['audio', 'video'])
            deps.trackController.currentTrack = mockTrackA
            expect(player.contentTypes).toEqual(new Set(['audio', 'video']))
        })

        it('returns qualities from current track', () => {
            expect(player.qualities).toBeNull()
            const mockTrackA = new MockTrack()
            const q = [createEmptyMediaQualityMetadata()]
            mockTrackA.qualities = q
            deps.trackController.currentTrack = mockTrackA
            expect(player.qualities).toBe(q)
        })

        it('returns qualitiesUnfiltered from current track', () => {
            expect(player.qualitiesUnfiltered).toBeNull()
            const mockTrackA = new MockTrack()
            const q = [createEmptyMediaQualityMetadata()]
            mockTrackA.qualitiesUnfiltered = q
            deps.trackController.currentTrack = mockTrackA
            expect(player.qualitiesUnfiltered).toBe(q)
        })

        it('deprecated getters work for backward compatibility', () => {
            const mockTrackA = new MockTrack()
            const audioQuality: MediaQualityMetadata = {
                ...createEmptyMediaQualityMetadata(),
                qualityId: 'audio-quality',
                contentType: 'audio',
            }

            mockTrackA.getStreamingQuality.and.callFake(
                (contentType: ContentType) =>
                    contentType === 'audio' ? audioQuality : null
            )
            mockTrackA.getBufferingQuality.and.callFake(
                (contentType: ContentType) =>
                    contentType === 'audio' ? audioQuality : null
            )
            mockTrackA.getPlaybackQuality.and.callFake(
                (contentType: ContentType) =>
                    contentType === 'audio' ? audioQuality : null
            )
            deps.trackController.currentTrack = mockTrackA

            // Test deprecated getters
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            expect(player.streamingQuality).toEqual(audioQuality)
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            expect(player.bufferingQuality).toEqual(audioQuality)
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            expect(player.playbackQuality).toEqual(audioQuality)
        })
    })

    describe('playbackQualityChange event', () => {
        describe('when the current track changes', () => {
            it('dispatches a playbackQualityChange event', () => {
                const playbackQualityChangeSpy = createEventSpy(
                    player,
                    'playbackQualityChange'
                )
                const qualityA: MediaQualityMetadata = {
                    ...createEmptyMediaQualityMetadata(),
                    qualityId: 'qA',
                    contentType: 'audio',
                }
                const qualityB: MediaQualityMetadata = {
                    ...createEmptyMediaQualityMetadata(),
                    qualityId: 'qB',
                    contentType: 'audio',
                }

                const mockTrackA = new MockTrack()
                mockTrackA.getPlaybackQuality.and.callFake(
                    (contentType: ContentType) =>
                        contentType === 'audio' ? qualityA : null
                )

                deps.trackController.dispatch('currentTrackChange', {
                    previous: null,
                    current: mockTrackA,
                })
                expect(playbackQualityChangeSpy).toHaveBeenCalledOnceWith({
                    previous: null,
                    current: qualityA,
                }) // Emitted on track change

                playbackQualityChangeSpy.calls.reset()
                mockTrackA.getPlaybackQuality.and.callFake(
                    (contentType: ContentType) =>
                        contentType === 'audio' ? qualityB : null
                )
                mockTrackA.dispatch('playbackQualityChange', {
                    previous: qualityA,
                    current: qualityB,
                })
                expect(playbackQualityChangeSpy).toHaveBeenCalledOnceWith({
                    previous: qualityA,
                    current: qualityB,
                })
                playbackQualityChangeSpy.calls.reset()

                deps.trackController.dispatch('currentTrackChange', {
                    previous: mockTrackA,
                    current: null,
                })
                expect(playbackQualityChangeSpy).toHaveBeenCalledOnceWith({
                    previous: qualityB,
                    current: null,
                })
            })
        })

        it('dispatches qualitiesChange on track switch', () => {
            const spy = createEventSpy(player, 'qualitiesChange')
            const mockTrackA = new MockTrack()
            const q = [createEmptyMediaQualityMetadata()]
            mockTrackA.qualities = q
            deps.trackController.dispatch('currentTrackChange', {
                previous: null,
                current: mockTrackA,
            })
            expect(spy).toHaveBeenCalledOnceWith({
                previous: [],
                current: q,
            })
        })

        it('dispatches qualitiesUnfilteredChange on track switch', () => {
            const spy = createEventSpy(player, 'qualitiesUnfilteredChange')
            const mockTrackA = new MockTrack()
            const q = [createEmptyMediaQualityMetadata()]
            mockTrackA.qualitiesUnfiltered = q
            deps.trackController.dispatch('currentTrackChange', {
                previous: null,
                current: mockTrackA,
            })
            expect(spy).toHaveBeenCalledOnceWith({
                previous: [],
                current: q,
            })
        })
    })

    describe('configure', () => {
        it('merges configuration shallowly with existing values', () => {
            // Set initial config
            player.configure({
                abr: {
                    highBufferThreshold: 10,
                    lowBufferThreshold: 5,
                },
                loudnessNormalization: {
                    enabled: true,
                },
            })

            // Partially update config - should replace, not merge
            player.configure({
                abr: {
                    highBufferThreshold: 20,
                },
            })

            expect(deps.options.value.abr.highBufferThreshold).toEqual(20)
            // abr settings should not be merged with previous abr settings:
            expect(deps.options.value.abr.lowBufferThreshold).toBeUndefined()
            // loudnessNormalization not provided, should be preserved
            expect(deps.options.value.loudnessNormalization.enabled).toBeTrue()
        })

        it('does not update config when values are deeply equal', () => {
            const configSpy = createSpy('config set')
            deps.options.onData(configSpy)
            configSpy.calls.reset() // ignore initial call

            // Configure with the same values
            player.configure({
                abr: {
                    ...defaultQualitySelectorImplOptions,
                },
            })

            expect(configSpy).not.toHaveBeenCalled()

            // Configure with the different values
            player.configure({
                abr: {
                    ...defaultQualitySelectorImplOptions,
                    highBufferThreshold: 1,
                },
            })

            expect(configSpy).toHaveBeenCalledTimes(1)
            configSpy.calls.reset()

            player.configure({
                abr: {
                    ...defaultQualitySelectorImplOptions,
                    highBufferThreshold: 1,
                },
            })

            expect(configSpy).not.toHaveBeenCalled()
        })
    })

    describe('when preferredAudioLanguage changes', () => {
        it('clears prefetch', () => {
            expect(deps.trackController.clearPrefetch).not.toHaveBeenCalled()
            player.configure({ preferredAudioLanguage: 'ja' })
            expect(deps.trackController.clearPrefetch).toHaveBeenCalledWith()
        })

        it('does not clear prefetch when value is unchanged', () => {
            player.configure({ preferredAudioLanguage: 'ja' })
            deps.trackController.clearPrefetch.calls.reset()
            player.configure({ preferredAudioLanguage: 'ja' })
            expect(deps.trackController.clearPrefetch).not.toHaveBeenCalled()
        })

        it('does not clear prefetch on initial options', () => {
            // clearPrefetch should not have been called from the initial options set
            expect(deps.trackController.clearPrefetch).not.toHaveBeenCalled()
        })
    })

    describe('client', () => {
        it('returns an object with the injected capabilities and user agent info', () => {
            expect(player.client).toEqual({
                capabilities: any(MockCapabilities),
            })
        })
    })

    describe('error property', () => {
        it('returns null initially', () => {
            expect(player.error).toBeNull()
        })

        it('stores the last error when error event is dispatched', () => {
            const error = new DrmError('test error')
            player.dispatch('error', { target: player, error })
            expect(player.error).toBe(error)
        })

        it('updates when a new error occurs', () => {
            const error1 = new DrmError('first error')
            const error2 = new DrmError('second error')

            player.dispatch('error', { target: player, error: error1 })
            expect(player.error).toBe(error1)

            player.dispatch('error', { target: player, error: error2 })
            expect(player.error).toBe(error2)
        })

        it('is cleared after reset', () => {
            const error = new DrmError('test error')
            player.dispatch('error', { target: player, error })
            expect(player.error).toBe(error)

            player.reset()
            expect(player.error).toBeNull()
        })
    })

    describe('reset', () => {
        it('does nothing when no error exists', () => {
            expect(player.error).toBeNull()
            player.reset()

            expect(deps.drmController.reset).not.toHaveBeenCalled()
            expect(deps.playbackController.reset).not.toHaveBeenCalled()
            expect(deps.trackController.reset).not.toHaveBeenCalled()
        })

        it('resets all controllers when error exists', () => {
            const error = new DrmError('test error')
            player.dispatch('error', { target: player, error })

            player.reset()

            expect(deps.drmController.reset).toHaveBeenCalledOnceWith()
            expect(deps.playbackController.reset).toHaveBeenCalledOnceWith()
            expect(deps.trackController.reset).toHaveBeenCalledOnceWith()
        })

        it('clears the error state', () => {
            const error = new DrmError('test error')
            player.dispatch('error', { target: player, error })
            expect(player.error).toBe(error)

            player.reset()
            expect(player.error).toBeNull()
        })

        it('dispatches reset event', () => {
            const resetSpy = createEventSpy(player, 'reset')
            const error = new DrmError('test error')
            player.dispatch('error', { target: player, error })

            player.reset()

            expect(resetSpy).toHaveBeenCalledOnceWith({})
        })

        it('does not bubble reset events from playback controller', () => {
            const resetSpy = createEventSpy(player, 'reset')

            // Simulate playback controller emitting reset event
            deps.playbackController.dispatch('reset', {})

            expect(resetSpy).not.toHaveBeenCalled()
        })

        it('only emits reset event from main reset method', () => {
            const resetSpy = createEventSpy(player, 'reset')
            const error = new DrmError('test error')
            player.dispatch('error', { target: player, error })

            // Reset events from sub-controllers should not bubble
            deps.playbackController.dispatch('reset', {})
            expect(resetSpy).not.toHaveBeenCalled()

            // Only the main reset method should emit the event
            player.reset()
            expect(resetSpy).toHaveBeenCalledOnceWith({})
        })

        it('does not bubble reset events from current track', () => {
            const resetSpy = createEventSpy(player, 'reset')
            const mockTrack = new MockTrack()

            // Set current track
            deps.trackController.dispatch('currentTrackChange', {
                previous: null,
                current: mockTrack,
            })

            // Simulate track emitting reset event
            mockTrack.dispatch('reset', {})

            expect(resetSpy).not.toHaveBeenCalled()
        })

        it('filters reset events from track streaming events', () => {
            const resetSpy = createEventSpy(player, 'reset')
            const mockTrack = new MockTrack()

            // Set current track
            deps.trackController.dispatch('currentTrackChange', {
                previous: null,
                current: mockTrack,
            })

            // Track reset events should not bubble
            mockTrack.dispatch('reset', {})
            expect(resetSpy).not.toHaveBeenCalled()

            // But other track events should still bubble
            const errorSpy = createEventSpy(player, 'error')
            const error = new DrmError('track error')
            mockTrack.dispatch('error', { target: mockTrack, error })
            expect(errorSpy).toHaveBeenCalledOnceWith({
                target: mockTrack,
                error,
            })
        })
    })

    describe('auto reset integration', () => {
        it('notifies auto reset controller of errors', () => {
            const error = new DrmError('test error')
            player.dispatch('error', { target: player, error })

            expect(deps.autoResetController.setError).toHaveBeenCalledOnceWith(
                error
            )
        })

        it('resets when auto reset controller emits reset event', () => {
            const error = new DrmError('test error')
            player.dispatch('error', { target: player, error })
            expect(player.error).toBe(error)

            deps.autoResetController.dispatch('reset', {})

            expect(player.error).toBeNull()
            expect(deps.drmController.reset).toHaveBeenCalledOnceWith()
            expect(deps.playbackController.reset).toHaveBeenCalledOnceWith()
            expect(deps.trackController.reset).toHaveBeenCalledOnceWith()
        })
    })

    describe('when drmController emits error event', () => {
        it('re-dispatches the error event', () => {
            const errorSpy = createEventSpy(player, 'error')
            const error = new DrmError('expected drm error')

            deps.drmController.dispatch('error', {
                target: deps.drmController,
                error,
            })

            expect(errorSpy).toHaveBeenCalledOnceWith({
                target: deps.drmController,
                error,
            })
        })
    })

    describe('disposed', () => {
        it('returns true if the player is disposed', () => {
            const player = createVinylPlayer(mockOptions, depFactories)
            expect(player.disposed).toBeFalse()
            player.dispose()
            expect(player.disposed).toBeTrue()
        })
    })

    describe('dispose', () => {
        it('disposes all non-external disposables added to the context', () => {
            const factories = {
                ...depFactories,
                // Non-external dependency:
                trackController: () => deps.trackController,
            }
            const player = createVinylPlayer(mockOptions, factories)
            expect(deps.playbackController.dispose).not.toHaveBeenCalled()
            player.dispose()
            // external, should not dispose:
            expect(
                deps.playbackController.dispose
            ).not.toHaveBeenCalledOnceWith()
            // not external, should dispose:
            expect(deps.trackController.dispose).toHaveBeenCalledOnceWith()
        })
    })
})

describe('createVinylPlayer', () => {
    polyfillCustomEvent()

    it('provides trackController options to the track controller', () => {
        const trackFactory = new MockTrackFactory()
        trackFactory.createTrack.and.callFake(() => new MockTrack())

        const playbackController = new MockPlaybackController()
        playbackController.play.and.resolveTo(void 0)

        const player = createVinylPlayer(
            {
                media: new MockHTMLAudioElement(),
                trackController: {
                    trackPrefetchCount: 0,
                },
            },
            {
                trackFactory: () => trackFactory,
                playbackController: () => playbackController,
            }
        )
        player.load(
            {
                type: 'src',
                uri: 'test',
            },
            {
                type: 'src',
                uri: 'test2',
            }
        )
        expect(trackFactory.createTrack).toHaveBeenCalledTimes(1)
        trackFactory.createTrack.calls.reset()
        player.dispose()
    })

    it('initializes global references', () => {
        const player = createVinylPlayer({
            media: new MockHTMLAudioElement(),
        })
        expect(consoleLogHandler.initialized).toBeTrue()
        expect(historyLogHandler.initialized).toBeTrue()
        expect(vinylGlobalRef.initialized).toBeTrue()
        player.dispose()
    })

    describe('when dependency overrides are provided', () => {
        it('uses overridden dependencies', () => {
            const playbackController = new MockPlaybackController()
            playbackController.currentTime = 42
            const player = createVinylPlayer(
                {
                    media: new MockHTMLAudioElement(),
                },
                {
                    test: () => 3,
                    playbackController: (_: { readonly test: number }) =>
                        playbackController,
                }
            )
            expect(player.currentTime).toBe(42)
            player.dispose()
        })

        it('prevents invalid overrides', () => {
            const media = new MockHTMLAudioElement()
            createVinylPlayer(
                { media },
                {
                    // @ts-expect-error Expected type Capabilities
                    capabilities: () => 0,
                }
            ).dispose()

            createVinylPlayer(
                { media },
                {
                    trackController: (_: {
                        playbackController: PlaybackController
                    }) => new MockTrackController<VinylTrackLoadOptions>(),
                }
            ).dispose()

            createVinylPlayer(
                { media },
                {
                    // @ts-expect-error Expect playbackController dependency to be incompatible
                    trackController: (_: {
                        playbackController: PlaybackController & {
                            notValid: 0
                        }
                    }) => new MockTrackController<VinylTrackLoadOptions>(),
                }
            ).dispose()
            expectNothing() // compile-time only test
        })

        describe('when trackFactory is overridden', () => {
            it(`provides the player typed to the factory's load parameters`, () => {
                {
                    const player = createVinylPlayer({
                        media: new MockHTMLAudioElement(),
                    })

                    expectTypeStrictlyEquals<typeof player, VinylPlayer>(true)
                    player.dispose()
                }

                {
                    const player = createVinylPlayer(
                        {
                            media: new MockHTMLAudioElement(),
                        },
                        {} // Empty object for overrides
                    )

                    expectTypeStrictlyEquals<typeof player, VinylPlayer>(true)
                    player.dispose()
                }

                {
                    const player = createVinylPlayer(
                        {
                            media: new MockHTMLAudioElement(),
                        },
                        {
                            trackFactory: (deps: SourceTrackDeps) => {
                                return createTrackFactory({
                                    src: createSourceTrackFactory(deps),
                                })
                            },
                        }
                    )
                    expectTypeStrictlyEquals<
                        typeof player,
                        VinylPlayer<SourceTrackLoadOptions>
                    >(true)
                    player.dispose()
                }

                {
                    const player = createVinylPlayer(
                        {
                            media: new MockHTMLAudioElement(),
                        },
                        {
                            trackFactory: () =>
                                createTrackFactory({
                                    test1: {
                                        validate() {},
                                        createTrack: (_options: {
                                            type: 'test1'
                                            uri: string
                                        }) => new MockTrack(),
                                    },
                                    test2: {
                                        validate() {},
                                        createTrack: (_options: {
                                            type: 'test2'
                                            uri: string
                                        }) => new MockTrack(),
                                    },
                                }),
                        }
                    )
                    expectTypeStrictlyEquals<
                        typeof player,
                        VinylPlayer<
                            | {
                                  type: 'test1'
                                  uri: string
                              }
                            | {
                                  type: 'test2'
                                  uri: string
                              }
                        >
                    >(true)
                    player.dispose()
                }
            })
        })

        describe('when config dependency is overridden', () => {
            it('provides a player with overridden configuration type', () => {
                {
                    type OverriddenOptions = {
                        readonly newOption?: number
                    }

                    const player = createVinylPlayer(
                        { media: new MockHTMLAudioElement() },
                        {
                            ...externalDependencies(
                                createMockVinylDependencies()
                            ),
                            options: () => data<OverriddenOptions>({}),
                        } as const
                    )

                    expectTypeStrictlyEquals<
                        typeof player,
                        VinylPlayer<VinylTrackLoadOptions, OverriddenOptions>
                    >(true)
                    player.dispose()
                }
            })
        })
    })
})
