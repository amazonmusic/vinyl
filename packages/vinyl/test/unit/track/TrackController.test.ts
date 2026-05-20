/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type ALL_TRACK_CONTROLLER_EVENTS,
    type TrackControllerEventMap,
    TrackControllerImpl,
    type TrackControllerImplDeps,
    type TrackLoadOptions,
    trackPriority,
} from '@amazon/vinyl'
import {
    createShortUid,
    DisposedError,
    type MutableDeep,
} from '@amazon/vinyl-util'
import {
    MockPlaybackController,
    MockTrack,
    MockTrackFactory,
} from '@amazon/vinyl/vinylTestUtil'
import { createEventSpy } from '@amazon/vinyl-util/testUtil'
import {
    expectIterableEquals,
    expectTypeStrictlyEquals,
    useMockTime,
} from '@amazon/vinyl-util/browserTestUtil'
import objectContaining = jasmine.objectContaining
import any = jasmine.any
import createSpy = jasmine.createSpy

describe('TrackControllerImpl', () => {
    let deps: {
        trackFactory: MockTrackFactory
        playbackController: MockPlaybackController
    }
    let trackController: TrackControllerImpl<TrackLoadOptions>
    let disposed = false

    // The number of non-disposed tracks created.
    let trackCount = 0

    const clock = useMockTime()

    beforeEach(() => {
        disposed = false
        deps = {
            playbackController: new MockPlaybackController(),
            trackFactory: new MockTrackFactory(),
        } as const satisfies TrackControllerImplDeps<TrackLoadOptions>
        trackCount = 0
        deps.trackFactory.createTrack.and.callFake((options) => {
            const track = new MockTrack()
            trackCount++
            track.implementActivateFakes()
            track.uri = options.uri
            track.dispose.and.callFake(() => {
                if (track.disposed) throw new DisposedError()
                track.disposed = true
                trackCount--
            })
            return track
        })
        deps.playbackController.play.and.resolveTo(void 0)

        trackController = new TrackControllerImpl<any>(deps)
        trackPriority.value = 0
    })

    afterEach(() => {
        if (!disposed) trackController.dispose()
    })

    /**
     * Creates a list of load options with unique uris.
     * @param count
     */
    function createLoadOptionsList(
        count: number
    ): MutableDeep<TrackLoadOptions>[] {
        const loadOptions: TrackLoadOptions[] = []
        for (let i = 0; i < count; i++) {
            loadOptions.push({
                type: '',
                uri: `${createShortUid()}_${i}`,
            })
        }
        return loadOptions
    }

    /**
     * Expects that with the given track list, the tracks included in the indices list are cached
     * while the tracks not included are not.
     *
     * @param tracks A list of load options to check.
     * @param indices The indices of the tracks provided expected to be cached.
     */
    function expectTracksCached(
        tracks: TrackLoadOptions[],
        indices: readonly number[]
    ) {
        const expected: boolean[] = []
        const actual: boolean[] = []
        for (let i = 0; i < tracks.length; i++) {
            expected.push(indices.includes(i))
            actual.push(trackController.isTrackCached(tracks[i].uri))
        }
        expect(actual).withContext(`cached tracks`).toEqual(expected)
    }

    describe('options', () => {
        it('returns the currently configured options', () => {
            const trackController = new TrackControllerImpl(deps, {
                trackPrefetchCount: 2,
            })
            expect(trackController.options).toEqual({
                trackPrefetchCount: 2,
                loadTimeout: 60,
                preloadCapacity: 2,
            })
            trackController.dispose()
        })
    })

    describe('configure', () => {
        it('merges provided options with the current configuration', () => {
            trackController.configure({
                trackPrefetchCount: 7,
            })
            expect(trackController.options).toEqual({
                trackPrefetchCount: 7,
                loadTimeout: 60,
                preloadCapacity: 2,
            })
            trackController.configure({
                loadTimeout: 20,
                preloadCapacity: 3,
            })
            expect(trackController.options).toEqual({
                trackPrefetchCount: 7,
                loadTimeout: 20,
                preloadCapacity: 3,
            })
        })

        describe('when preloadCapacity is increased', () => {
            it('increases the cache capacity', () => {
                trackController.configure({
                    preloadCapacity: 5,
                })
                expect(trackController.preloadCapacity).toBe(5)
            })
        })

        describe('when preloadCapacity is decreased', () => {
            it('does not decrease cache capacity until next clear', () => {
                trackController.load(...createLoadOptionsList(5))
                const preloadedTracks = createLoadOptionsList(3)
                trackController.preload(...preloadedTracks)
                trackController.configure({
                    preloadCapacity: 1,
                })
                expect(trackController.preloadCapacity).toBe(3)
                expectTracksCached(preloadedTracks, [0, 1, 2])

                trackController.clearTrackCache()
                expect(trackController.preloadCapacity).toBe(1)
            })
        })
    })

    describe('preload', () => {
        describe('when the provided track options exceed the current preloadCapacity', () => {
            it('expands the preloadCapacity', () => {
                expect(trackController.preloadCapacity).toBe(
                    trackController.options.preloadCapacity
                )
                trackController.preload(...createLoadOptionsList(5))
                expect(trackController.preloadCapacity).toBe(5)
                trackController.preload(...createLoadOptionsList(6))
                expect(trackController.preloadCapacity).toBe(6)
                trackController.preload(...createLoadOptionsList(3))
                expect(trackController.preloadCapacity).toBe(6)
            })
        })

        it('creates and caches tracks for the provided load options', () => {
            const loadOptionsList = createLoadOptionsList(3)
            trackController.preload(...loadOptionsList)
            const createTrack = deps.trackFactory.createTrack
            expect(createTrack).toHaveBeenCalledWith(loadOptionsList[0])
            expect(createTrack).toHaveBeenCalledWith(loadOptionsList[1])
            expect(createTrack).toHaveBeenCalledWith(loadOptionsList[2])
            createTrack.calls.reset()
            // All should now be cached:
            trackController.preload(...loadOptionsList)
            expect(createTrack).not.toHaveBeenCalled()
            trackController.preload(...createLoadOptionsList(2))
            expect(createTrack).toHaveBeenCalledTimes(2)
        })

        it('validates all tracks', () => {
            const loadOptionsList = createLoadOptionsList(3)
            trackController.preload(...loadOptionsList)
            expect(deps.trackFactory.validate).toHaveBeenCalledTimes(3)
            expect(deps.trackFactory.validate).toHaveBeenCalledWith(
                loadOptionsList[0]
            )
            expect(deps.trackFactory.validate).toHaveBeenCalledWith(
                loadOptionsList[1]
            )
            expect(deps.trackFactory.validate).toHaveBeenCalledWith(
                loadOptionsList[2]
            )
        })

        it('configures preloaded tracks', () => {
            const loadOptions: TrackLoadOptions[] = []
            for (let i = 0; i < 3; i++) {
                loadOptions.push({
                    type: '',
                    uri: `${createShortUid()}_${i}`,
                    config: {
                        startTime: i * 10,
                    },
                })
            }
            trackController.preload(...loadOptions)
            for (let i = 0; i < 3; i++) {
                expect(
                    (
                        trackController.getCachedTrack(
                            loadOptions[i].uri
                        ) as MockTrack
                    ).preload
                ).toHaveBeenCalledOnceWith(
                    { prefetchPriority: 3 - i },
                    { startTime: i * 10 }
                )
            }
        })
    })

    describe('load', () => {
        it('sets the track queue', () => {
            const loadOptionsList = createLoadOptionsList(5)
            trackController.load(...loadOptionsList)
            expect(trackController.queue).toEqual(loadOptionsList.slice(1))
        })

        it('activates the first track', () => {
            const loadOptions1 = createLoadOptionsList(2)
            trackController.load(...loadOptions1)
            expect(trackController.currentTrack?.uri).toBe(loadOptions1[0].uri)
            const track1 = trackController.currentTrack as MockTrack
            expect(track1.activate).toHaveBeenCalledWith({})

            const loadOptions2 = createLoadOptionsList(2)
            const config1 = { extra: 3 }
            loadOptions2[0].config = config1
            trackController.load(...loadOptions2)
            expect(trackController.currentTrack?.uri).not.toBe(
                loadOptions1[0].uri
            )
            expect(trackController.currentTrack?.uri).toBe(loadOptions2[0].uri)
            const track2 = trackController.currentTrack as MockTrack
            expect(track1.deactivate).toHaveBeenCalledWith()
            expect(track2.activate).toHaveBeenCalledWith(config1)
        })

        it('configures preloaded tracks', () => {
            const loadOptions: TrackLoadOptions[] = []
            for (let i = 0; i < 10; i++) {
                loadOptions.push({
                    type: '',
                    uri: `${createShortUid()}_${i}`,
                    config: {
                        startTime: i * 10,
                    },
                })
            }
            trackController.load(...loadOptions)
            for (
                let i = 0;
                i < trackController.options.trackPrefetchCount + 1; // +1 for current track
                i++
            ) {
                const track = trackController.getCachedTrack(
                    loadOptions[i].uri
                ) as MockTrack

                expect(track.preload).toHaveBeenCalledOnceWith(
                    {
                        prefetchPriority:
                            trackController.options.trackPrefetchCount + 1 - i,
                    },
                    { startTime: i * 10 }
                )
            }
        })

        it('sets priority', () => {
            function getTrackPriority(track: MockTrack): number {
                return track.preload.calls.mostRecent().args[0].prefetchPriority
            }
            const loadOptions = createLoadOptionsList(3)
            trackController.preload(...loadOptions)
            const tracks1 = loadOptions.map(
                (it) => trackController.getCachedTrack(it.uri)! as MockTrack
            )
            expect(getTrackPriority(tracks1[0])).toBeGreaterThan(
                getTrackPriority(tracks1[1])
            )
            expect(getTrackPriority(tracks1[1])).toBeGreaterThan(
                getTrackPriority(tracks1[2])
            )

            trackController.preload(loadOptions[2])
            expect(getTrackPriority(tracks1[2])).toBeGreaterThan(
                getTrackPriority(tracks1[0])
            )
            expect(getTrackPriority(tracks1[0])).toBeGreaterThan(
                getTrackPriority(tracks1[1])
            )

            // All tracks in new batch should have higher priority than previous batch.
            const loadOptions2 = createLoadOptionsList(3)
            trackController.preload(...loadOptions2)
            const tracks2 = loadOptions2.map(
                (it) => trackController.getCachedTrack(it.uri)! as MockTrack
            )
            // New next track should have the highest priority.
            expect(getTrackPriority(tracks2[0])).toBeGreaterThan(
                getTrackPriority(tracks2[1])
            )
            expect(getTrackPriority(tracks2[1])).toBeGreaterThan(
                getTrackPriority(tracks2[2])
            )
            expect(getTrackPriority(tracks2[2])).toBeGreaterThan(
                getTrackPriority(tracks1[2])
            )
        })

        describe('if the first track is already active', () => {
            it('deactivates then re-activates the track', () => {
                const loadOptionsList = createLoadOptionsList(3)
                trackController.load(...loadOptionsList)

                const track = trackController.currentTrack as MockTrack

                expect(track.activate).toHaveBeenCalledWith({})
                expect(track.deactivate).not.toHaveBeenCalled()

                track.activate.calls.reset()
                track.deactivate.calls.reset()

                trackController.load(...loadOptionsList)
                expect(track.deactivate).toHaveBeenCalled()
                expect(track.activate).toHaveBeenCalledWith({})
                expect(track.deactivate).toHaveBeenCalledBefore(track.activate)
            })
        })

        it('deactivates and reactivates current track if unchanged', () => {
            const loadOptionsList = createLoadOptionsList(3)
            trackController.load(...loadOptionsList)
            const currentTrack = trackController.currentTrack as MockTrack
            expect(currentTrack.activate).toHaveBeenCalledOnceWith({})
            currentTrack.activate.calls.reset()
            trackController.load(loadOptionsList[0])
            expect(currentTrack.deactivate).toHaveBeenCalled()
            expect(currentTrack.activate).toHaveBeenCalled()
        })

        it('reuses currentTrack', () => {
            const trackController = new TrackControllerImpl<any>(deps, {
                trackPrefetchCount: 0, // Only the current track is cached
            })
            const loadOptionsList = createLoadOptionsList(3)
            trackController.load(...loadOptionsList)
            const currentTrack = trackController.currentTrack
            trackController.load(...loadOptionsList)
            expect(trackController.currentTrack).toBe(currentTrack)
            trackController.dispose()
        })

        it('prefetches trackPrefetchCount tracks ahead', () => {
            const tracks = createLoadOptionsList(6)
            trackController.configure({
                trackPrefetchCount: 3,
                preloadCapacity: 0, // evict all tracks behind the prefetch
            })

            // no need to await, not waiting load. Ignore abort rejection.
            trackController.load(...tracks)
            expectTracksCached(tracks, [0, 1, 2, 3]) // indices 1-3 prefetched, 0 is current.

            trackController.next()
            expectTracksCached(tracks, [1, 2, 3, 4]) // 0 should be evicted
        })

        it('creates the tracks in order', () => {
            // If the tracks are not created in order, prefetch priority may be incorrect.
            const tracks = createLoadOptionsList(6)
            trackController.configure({
                trackPrefetchCount: 3,
            })
            trackController.load(...tracks)
            for (let i = 0; i < 4; i++) {
                const track = trackController.getCachedTrack(tracks[i].uri)!
                const createdIndex = deps.trackFactory.createTrack.calls
                    .all()
                    .findIndex((call) => call.returnValue === track)
                expect(createdIndex).toBe(i)
            }
        })

        describe('when called during a track ended event', () => {
            it('prevents the next automatic next()', async () => {
                const loadOptionsList = createLoadOptionsList(3)
                trackController.load(...loadOptionsList)
                deps.playbackController.dispatch('ended', {})
                trackController.load(...loadOptionsList)
                await clock.tick()
                expect(trackController.currentTrack?.uri).toEqual(
                    loadOptionsList[0].uri
                )

                // Does not prevent subsequent ended events from progressing queue.
                deps.playbackController.dispatch('ended', {})
                await clock.tick()
                expect(trackController.currentTrack?.uri).toEqual(
                    loadOptionsList[1].uri
                )
            })
        })

        it('validates all tracks', () => {
            const loadOptionsList = createLoadOptionsList(3)
            trackController.load(...loadOptionsList)
            expect(deps.trackFactory.validate).toHaveBeenCalledTimes(3)
            expect(deps.trackFactory.validate).toHaveBeenCalledWith(
                loadOptionsList[0]
            )
            expect(deps.trackFactory.validate).toHaveBeenCalledWith(
                loadOptionsList[1]
            )
            expect(deps.trackFactory.validate).toHaveBeenCalledWith(
                loadOptionsList[2]
            )
        })
    })

    describe('enqueue', () => {
        it('appends the given track load options to the current queue', () => {
            trackController.enqueue()
            expect(trackController.queue).toEqual([])

            const tracks1 = createLoadOptionsList(1)
            const tracks2 = createLoadOptionsList(2)
            const tracks3 = createLoadOptionsList(3)
            trackController.enqueue(...tracks1)
            expect(trackController.queue).toEqual([])
            expect(trackController.currentTrack?.uri).toBe(tracks1[0].uri)
            trackController.enqueue(...tracks2)
            expect(trackController.queue).toEqual(tracks2)
            trackController.enqueue(...tracks3)
            expect(trackController.queue).toEqual([...tracks2, ...tracks3])
        })

        it('preloads up to preloadFetchCount tracks', () => {
            const tracks = createLoadOptionsList(5)
            trackController.enqueue(...tracks)
            expect(trackCount).toBe(
                trackController.options.trackPrefetchCount + 1 // +1 for current track
            )
        })

        it('validates all tracks', () => {
            const loadOptionsList = createLoadOptionsList(3)
            trackController.enqueue(...loadOptionsList)
            expect(deps.trackFactory.validate).toHaveBeenCalledTimes(3)
            expect(deps.trackFactory.validate).toHaveBeenCalledWith(
                loadOptionsList[0]
            )
            expect(deps.trackFactory.validate).toHaveBeenCalledWith(
                loadOptionsList[1]
            )
            expect(deps.trackFactory.validate).toHaveBeenCalledWith(
                loadOptionsList[2]
            )
        })
    })

    describe('next', () => {
        it('shifts the queue, activating the next track', () => {
            trackController.configure({ preloadCapacity: 0 })
            trackController.next()
            expect(trackController.currentTrack).toBeNull()

            const tracks = createLoadOptionsList(5)
            trackController.load(...tracks)
            let currentIndex = 0

            function testNext() {
                ++currentIndex
                trackController.next()
                expect(trackController.queue[0]).toEqual(
                    tracks[currentIndex + 1]
                )
                expect(trackController.currentTrack?.uri)
                    .withContext(`currentTrack ${currentIndex}`)
                    .toBe(tracks[currentIndex].uri)

                // Expect next tracks until trackPrefetchCount are prefetched.
                for (let i = currentIndex; i < tracks.length; i++) {
                    expect(
                        trackController.isTrackCached(tracks[i].uri)
                    ).toEqual(
                        i - currentIndex <=
                            trackController.options.trackPrefetchCount
                    )
                }
            }

            testNext() // 1
            testNext() // 2
            testNext() // 3
            testNext() // 4, last track

            // Reached the end
            trackController.next()
            expect(trackController.queue).toEqual([])
            expect(trackController.currentTrack).toBeNull()

            expect(trackCount).toBe(
                trackController.options.trackPrefetchCount + 1
            )
        })

        describe('when the current track is ended or not paused', () => {
            it('invokes playbackController.play', () => {
                const play = deps.playbackController.play
                const tracks = createLoadOptionsList(3)
                trackController.load(...tracks)
                deps.playbackController.paused = true
                deps.playbackController.ended = true
                expect(play).not.toHaveBeenCalled()
                trackController.next()
                expect(play).toHaveBeenCalledTimes(1)

                deps.playbackController.play.calls.reset()
                deps.playbackController.paused = false
                deps.playbackController.ended = false
                expect(play).not.toHaveBeenCalled()
                trackController.next()
                expect(deps.playbackController.play).toHaveBeenCalledTimes(1)
            })
        })

        describe('when the current track is paused and not ended', () => {
            it('does not invoke playbackController.play', () => {
                const play = deps.playbackController.play
                const tracks = createLoadOptionsList(3)
                trackController.load(...tracks)
                deps.playbackController.paused = true
                deps.playbackController.ended = false
                expect(play).not.toHaveBeenCalled()
                trackController.next()
                expect(play).not.toHaveBeenCalled()
            })
        })

        describe('when called during a track ended event', () => {
            it('prevents the next automatic next()', async () => {
                const loadOptionsList = createLoadOptionsList(3)
                trackController.load(...loadOptionsList)
                deps.playbackController.dispatch('ended', {})
                trackController.next()
                await clock.tick()
                expect(trackController.currentTrack?.uri).toEqual(
                    loadOptionsList[1].uri
                )

                // Does not prevent subsequent ended events from progressing queue.
                deps.playbackController.dispatch('ended', {})
                await clock.tick()
                expect(trackController.currentTrack?.uri).toEqual(
                    loadOptionsList[2].uri
                )
            })
        })
    })

    describe('currentTrackChanging event', () => {
        it('is emitted when the track changes, before the current track is deactivated', () => {
            const trackChangingSpy = createSpy('trackChanging').and.callFake(
                (event) => {
                    // Ensure that changing happens before the previous track is deactivated
                    if (event.previous) expect(event.previous.active).toBeTrue()
                    if (event.current) expect(event.current.active).toBeFalse()
                }
            )
            trackController.on('currentTrackChanging', trackChangingSpy)
            const trackChangeSpy = createSpy('trackChange').and.callFake(
                // Ensure that change happens after the new track is activated
                (event) => {
                    if (event.previous)
                        expect(event.previous.active).toBeFalse()
                    if (event.current) expect(event.current.active).toBeTrue()
                }
            )
            trackController.on('currentTrackChange', trackChangeSpy)
            trackController.load(
                {
                    type: '',
                    uri: `test_0`,
                },
                {
                    type: '',
                    uri: `test_1`,
                },
                {
                    type: '',
                    uri: `test_2`,
                }
            )
            expect(trackChangingSpy.calls.count()).toBe(1)
            expect(trackChangeSpy.calls.count()).toBe(1)
            trackChangingSpy.calls.reset()
            trackChangeSpy.calls.reset()
            trackController.next()
            expect(trackChangingSpy.calls.count()).toBe(1)
            expect(trackChangeSpy.calls.count()).toBe(1)
            expect(trackChangingSpy).toHaveBeenCalledBefore(trackChangeSpy)
            const changingEvent = trackChangingSpy.calls.mostRecent().args[0]
            expect(changingEvent).toEqual({
                previous: objectContaining({
                    uri: `test_0`,
                }),
                current: objectContaining({
                    uri: `test_1`,
                }),
            })
        })
    })

    describe('when the current track ends', () => {
        it('moves to the next track', async () => {
            const loadOptionsList = createLoadOptionsList(3)
            const trackChangeSpy = createEventSpy(
                trackController,
                'currentTrackChange'
            )
            trackController.load(...loadOptionsList)
            let nextTrackChange = trackChangeSpy.next()
            deps.playbackController.dispatch('ended', {})
            await clock.tick()

            await expectAsync(nextTrackChange).toBeResolvedTo({
                previous: objectContaining({
                    uri: loadOptionsList[0].uri,
                }),
                current: objectContaining({
                    uri: loadOptionsList[1].uri,
                }),
            })

            nextTrackChange = trackChangeSpy.next()
            deps.playbackController.dispatch('ended', {})
            await clock.tick()
            await expectAsync(nextTrackChange).toBeResolvedTo({
                previous: objectContaining({
                    uri: loadOptionsList[1].uri,
                }),
                current: objectContaining({
                    uri: loadOptionsList[2].uri,
                }),
            })
        })
    })

    describe('unload', () => {
        it('unloads the active track and clears the queue', () => {
            trackController.load(...createLoadOptionsList(3))
            trackController.unload()
            expect(trackController.queue).toEqual([])
            expect(trackController.currentTrack).toBeNull()
        })
    })

    describe('clearTrackCache', () => {
        const loadOptionsList = createLoadOptionsList(3)

        beforeEach(() => {
            trackController.load(...loadOptionsList)
        })

        it('clears the cache', () => {
            expect(
                trackController.isTrackCached(loadOptionsList[0].uri)
            ).toBeTrue()

            trackController.clearTrackCache()
            expect(
                trackController.isTrackCached(loadOptionsList[0].uri)
            ).toBeFalse()
        })

        it('deactivates the current track', () => {
            const track = trackController.currentTrack!
            expect(track).not.toBeNull()
            trackController.clearTrackCache()
            expect(trackController.currentTrack).toBeNull()
            expect(track.active).toBeFalse()
        })

        it('clears the queue', () => {
            trackController.clearTrackCache()
            expect(trackController.queue).toEqual([])
        })

        describe('when called during a track ended event', () => {
            it('prevents the next automatic next()', async () => {
                const loadOptionsList = createLoadOptionsList(3)
                trackController.load(...loadOptionsList)
                deps.playbackController.dispatch('ended', {})
                trackController.clearTrackCache()
                await clock.tick()
                expect(trackController.currentTrack).toBeNull()
            })
        })

        it('resets the auto preload capacity', () => {
            trackController.preload(...createLoadOptionsList(5))
            expect(trackController.preloadCapacity).toBe(5)
            trackController.clearTrackCache()
            expect(trackController.preloadCapacity).toBe(
                trackController.options.preloadCapacity
            )
        })
    })

    describe('clearPrefetch', () => {
        it('calls clearPrefetch on all cached tracks', () => {
            trackController.load(...createLoadOptionsList(3))
            trackController.clearPrefetch()

            const allTracks = Array.from(
                trackController.getCachedTracks()
            ) as MockTrack[]
            expect(allTracks.length).toBe(3) // sanity check
            for (const track of allTracks) {
                expect(track.clearPrefetch).toHaveBeenCalledTimes(1)
            }
        })
    })

    describe('clearQueue', () => {
        it('clears the queue without unloading the current track', () => {
            const tracks = createLoadOptionsList(3)
            trackController.load(...tracks)
            trackController.clearQueue()
            expect(trackController.queue).toEqual([])
            expect(trackController.currentTrack?.uri).toBe(tracks[0].uri)
        })
    })

    describe('isTrackCached', () => {
        it('returns true if the uri is a cached track', () => {
            const loadOptionsList = createLoadOptionsList(5)
            expect(
                trackController.isTrackCached(loadOptionsList[0].uri)
            ).toBeFalse()
            trackController.load(...loadOptionsList)
            expect(
                trackController.isTrackCached(loadOptionsList[0].uri)
            ).toBeTrue()
            expect(
                trackController.isTrackCached(loadOptionsList[1].uri)
            ).toBeTrue()
            expect(
                trackController.isTrackCached(loadOptionsList[2].uri)
            ).toBeTrue()
            expect(
                trackController.isTrackCached(
                    loadOptionsList[
                        trackController.options.trackPrefetchCount + 1
                    ].uri
                )
            ).toBeFalse()

            trackController.preload(...loadOptionsList) // Expands cache size
            expect(
                trackController.isTrackCached(loadOptionsList[4].uri)
            ).toBeTrue()
        })

        describe('when preload and trackPrefetch sizes are zero', () => {
            let trackController: TrackControllerImpl<any>
            beforeEach(() => {
                trackController = new TrackControllerImpl<any>(deps, {
                    trackPrefetchCount: 0, // Only the current track is cached
                })
            })
            afterEach(() => {
                trackController.dispose()
            })

            it('returns true if the uri is the current track', () => {
                const trackController = new TrackControllerImpl<any>(deps, {
                    trackPrefetchCount: 0, // Only the current track is cached
                    preloadCapacity: 0,
                })
                const loadOptionsList = createLoadOptionsList(3)
                trackController.load(...loadOptionsList)
                expect(
                    trackController.isTrackCached(loadOptionsList[0].uri)
                ).toBeTrue()
                expect(
                    trackController.isTrackCached(loadOptionsList[1].uri)
                ).toBeFalse()
                trackController.next()
                expect(
                    trackController.isTrackCached(loadOptionsList[1].uri)
                ).toBeTrue()
                expect(
                    trackController.isTrackCached(loadOptionsList[0].uri)
                ).toBeFalse()
                expect(
                    trackController.isTrackCached(loadOptionsList[2].uri)
                ).toBeFalse()
                trackController.dispose()
            })
        })
    })

    describe('getCachedTrack', () => {
        it('returns the cached track for the given uri', () => {
            const loadOptionsList = createLoadOptionsList(5)
            expect(
                trackController.getCachedTrack(loadOptionsList[0].uri)
            ).toBeNull()
            trackController.load(...loadOptionsList)
            expect(
                trackController.getCachedTrack(loadOptionsList[0].uri)
            ).toBeInstanceOf(MockTrack)
            expect(
                trackController.getCachedTrack(loadOptionsList[1].uri)
            ).toBeInstanceOf(MockTrack)
            expect(
                trackController.getCachedTrack(loadOptionsList[2].uri)
            ).toBeInstanceOf(MockTrack)
            expect(
                trackController.getCachedTrack(
                    loadOptionsList[
                        trackController.options.trackPrefetchCount + 1
                    ].uri
                )
            ).toBeNull()
        })
    })

    describe('getCachedTracks', () => {
        it('returns an iterator for the currently cached tracks', () => {
            expectIterableEquals(trackController.getCachedTracks(), [])
            const loadOptionsList = createLoadOptionsList(5)
            trackController.load(...loadOptionsList)
            expect(Array.from(trackController.getCachedTracks())).toEqual([
                any(MockTrack),
                any(MockTrack),
                any(MockTrack),
            ])
        })
    })

    describe('when last track in the queue ends', () => {
        it('dispatches a queueEnded event', async () => {
            const queueEndedSpy = createEventSpy(trackController, 'queueEnded')
            trackController.load(...createLoadOptionsList(1))
            expect(queueEndedSpy).not.toHaveBeenCalled()
            deps.playbackController.dispatch('ended', {})
            await clock.tick()
            expect(queueEndedSpy).toHaveBeenCalledWith({})
            queueEndedSpy.calls.reset()

            const loadOptionsList = createLoadOptionsList(3)
            trackController.load(...loadOptionsList)
            deps.playbackController.dispatch('ended', {})
            await clock.tick()
            expect(queueEndedSpy).not.toHaveBeenCalled()
            deps.playbackController.dispatch('ended', {})
            await clock.tick()
            expect(queueEndedSpy).not.toHaveBeenCalled()
            deps.playbackController.dispatch('ended', {})
            await clock.tick()
            expect(queueEndedSpy).toHaveBeenCalledWith({})
        })
    })

    describe('when the queue changes', () => {
        it('dispatches queueChange event', () => {
            const queueChangeSpy = createEventSpy(
                trackController,
                'queueChange'
            )
            const tracks = [
                {
                    type: '',
                    uri: `uri_0`,
                },
                {
                    type: '',
                    uri: `uri_1`,
                },
                {
                    type: '',
                    uri: `uri_2`,
                },
                {
                    type: '',
                    uri: `uri_3`,
                },
            ]

            trackController.load(...tracks)
            expect(queueChangeSpy).toHaveBeenCalledOnceWith({
                previous: [],
                current: [
                    {
                        type: '',
                        uri: `uri_1`,
                    },
                    {
                        type: '',
                        uri: `uri_2`,
                    },
                    {
                        type: '',
                        uri: `uri_3`,
                    },
                ],
            })
            queueChangeSpy.calls.reset()

            trackController.next()
            expect(queueChangeSpy).toHaveBeenCalledOnceWith({
                previous: [
                    {
                        type: '',
                        uri: `uri_1`,
                    },
                    {
                        type: '',
                        uri: `uri_2`,
                    },
                    {
                        type: '',
                        uri: `uri_3`,
                    },
                ],
                current: [
                    {
                        type: '',
                        uri: `uri_2`,
                    },
                    {
                        type: '',
                        uri: `uri_3`,
                    },
                ],
            })

            queueChangeSpy.calls.reset()
            trackController.clearQueue()
            expect(queueChangeSpy).toHaveBeenCalledOnceWith({
                previous: [
                    {
                        type: '',
                        uri: `uri_2`,
                    },
                    {
                        type: '',
                        uri: `uri_3`,
                    },
                ],
                current: [],
            })

            queueChangeSpy.calls.reset()

            trackController.preload({
                type: '',
                uri: `uri_4`,
            })
            expect(queueChangeSpy).not.toHaveBeenCalled()

            trackController.enqueue({
                type: '',
                uri: `uri_4`,
            })
            expect(queueChangeSpy).toHaveBeenCalledOnceWith({
                previous: [],
                current: [
                    {
                        type: '',
                        uri: `uri_4`,
                    },
                ],
            })

            queueChangeSpy.calls.reset()
            trackController.clearTrackCache()
            expect(queueChangeSpy).toHaveBeenCalledOnceWith({
                previous: [
                    {
                        type: '',
                        uri: `uri_4`,
                    },
                ],
                current: [],
            })
        })
    })

    describe('reset', () => {
        it('resets current track', () => {
            trackController.load(...createLoadOptionsList(1))
            const track = trackController.currentTrack as MockTrack

            trackController.reset()

            expect(track.reset).toHaveBeenCalled()
        })

        it('does nothing when no current track', () => {
            expect(() => trackController.reset()).not.toThrow()
        })
    })

    describe('dispose', () => {
        afterEach(() => {
            disposed = true
        })

        it('removes all handlers', () => {
            trackController.dispose()
            expect(deps.playbackController.hasAnyListeners()).toBeFalse()
        })

        it('disposes current track', () => {
            trackController.load(...createLoadOptionsList(1))
            const track = trackController.currentTrack as MockTrack
            trackController.dispose()
            expect(track.dispose).toHaveBeenCalledOnceWith()
        })

        it('disposes all tracks', () => {
            const loadOptionsList = createLoadOptionsList(5)
            trackController.load(...loadOptionsList)

            // Prefetched + current
            expect(trackCount).toBe(
                trackController.options.trackPrefetchCount + 1
            )
            expect(trackCount).toBeGreaterThan(0)

            trackController.dispose()
            expect(trackCount).toBe(0)
        })
    })
})

describe('ALL_TRACK_CONTROLLER_EVENTS', () => {
    it('provides a comprehensive list of all track controller events', () => {
        expectTypeStrictlyEquals<
            keyof TrackControllerEventMap<any>,
            (typeof ALL_TRACK_CONTROLLER_EVENTS)[number]
        >(true)
    })
})
