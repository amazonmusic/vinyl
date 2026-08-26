/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type AdBreakList,
    type ContentType,
    createEmptyMediaQualityMetadata,
    type MediaTimeline,
    MseTrack,
    PLAYHEAD_NUDGE,
    type RestrictableContentType,
    SEEKING_STALL_TIME_CHECK,
    type TrackConfigOptions,
    type TrackPreloadOptions,
} from '@amazon/vinyl'
import type { MockContentStream } from '@amazon/vinyl/vinylTestUtil'
import {
    createMockDashDependencies,
    type MockDashDependencies,
} from '@amazon/vinyl/vinylTestUtil'
import { createEventSpy, useMockLogger } from '@amazon/vinyl-util/testUtil'
import { flushPromises, useMockTime } from '@amazon/vinyl-util/browserTestUtil'
import { externalDependencies } from '@amazon/vinyl-di'
import { Abort } from '@amazon/vinyl-util'
import any = jasmine.any

describe('MseTrack', () => {
    useMockLogger()

    let deps: MockDashDependencies
    let track: MseTrack | null

    function createTrack(uri = 'uri', type = 'mse') {
        return new MseTrack(uri, type, externalDependencies(deps))
    }

    function getAllStreams(): MockContentStream[] {
        return deps.contentStreamFactory.calls
            .all()
            .map((call) => call.returnValue)
    }

    /**
     * Gets the mock stream by returning the first stream created for the given content type.
     * @param contentType
     */
    function getStream(contentType: ContentType): MockContentStream | null {
        return (
            deps.contentStreamFactory.calls
                .all()
                .find((c) => c.args[0] === contentType)?.returnValue ?? null
        )
    }

    function getAudioStream(): MockContentStream {
        return getStream('audio')!
    }

    function getVideoStream(): MockContentStream {
        return getStream('video')!
    }

    beforeEach(() => {
        track = null
        deps = createMockDashDependencies()
        deps.contentTypesValue.value = Promise.resolve(
            new Set(['audio', 'video'])
        )
        deps.playbackController.play.and.resolveTo(void 0)
    })

    afterEach(() => {
        if (!track?.disposed) track?.dispose()
    })

    async function awaitContentTypes(): Promise<void> {
        await deps.contentTypesValue.value
    }

    describe('fetchedRanges', () => {
        it('returns intersection of all content stream ranges', async () => {
            track = createTrack()
            expect(track.fetchedRanges.empty).toBeTrue()

            await awaitContentTypes()

            const audioStream = getAudioStream()
            const videoStream = getVideoStream()

            // Initially both streams have empty ranges - intersection is empty
            expect(track.fetchedRanges.empty).toBeTrue()

            // Add ranges to audio stream only - intersection is still empty
            audioStream.fetchedRanges.add(0, 10)
            audioStream.fetchedRanges.add(20, 30)
            audioStream.dispatch('fetchedRangesChange', {})

            expect(track.fetchedRanges.empty).toBeTrue()

            // Add overlapping ranges to video stream
            videoStream.fetchedRanges.add(5, 15)
            videoStream.fetchedRanges.add(25, 35)
            videoStream.dispatch('fetchedRangesChange', {})

            // Should have intersection of both ranges
            expect(track.fetchedRanges.ranges).toEqual([
                [5, 10], // intersection of [0,10] and [5,15]
                [25, 30], // intersection of [20,30] and [25,35]
            ])
        })

        it('updates ranges when content streams change', async () => {
            track = createTrack()
            await awaitContentTypes()

            const audioStream = getAudioStream()
            const videoStream = getVideoStream()

            // Add overlapping ranges
            audioStream.fetchedRanges.add(0, 10)
            videoStream.fetchedRanges.add(5, 15)
            audioStream.dispatch('fetchedRangesChange', {})
            videoStream.dispatch('fetchedRangesChange', {})

            expect(track.fetchedRanges.ranges).toEqual([[5, 10]])

            // Clear audio ranges - intersection becomes empty
            audioStream.fetchedRanges.clear()
            audioStream.dispatch('fetchedRangesChange', {})

            expect(track.fetchedRanges.empty).toBeTrue()

            // Add back audio ranges
            audioStream.fetchedRanges.add(8, 12)
            audioStream.dispatch('fetchedRangesChange', {})

            // Should have new intersection
            expect(track.fetchedRanges.ranges).toEqual([[8, 12]])
        })
    })

    describe('clearPrefetch', () => {
        it('calls clearPrefetch on the streams', async () => {
            track = createTrack()
            await awaitContentTypes()
            track.clearPrefetch()
            expect(getAudioStream().clearPrefetch).toHaveBeenCalledOnceWith()
            expect(getVideoStream().clearPrefetch).toHaveBeenCalledOnceWith()
        })
    })

    describe('reset', () => {
        it('no-ops if no error', async () => {
            track = createTrack()
            await awaitContentTypes()
            track.reset()
            expect(deps.manifestController.reset).not.toHaveBeenCalled()
            expect(getAudioStream().reset).not.toHaveBeenCalled()
            expect(getVideoStream().reset).not.toHaveBeenCalled()
        })

        describe('when in an error state', () => {
            beforeEach(async () => {
                track = createTrack()
                await awaitContentTypes()
                getAudioStream().dispatch('error', {
                    error: new Error('error'),
                    target: getAudioStream(),
                })
            })

            it('calls reset on the streams and manifestController', () => {
                track!.reset()
                expect(deps.manifestController.reset).toHaveBeenCalledOnceWith()
                expect(getAudioStream().reset).toHaveBeenCalledOnceWith()
                expect(getVideoStream().reset).toHaveBeenCalledOnceWith()
            })

            it('dispatches a reset event', () => {
                const resetSpy = createEventSpy(track!, 'reset')
                track!.reset()
                expect(resetSpy).toHaveBeenCalledTimes(1)
            })
        })
    })

    describe('preload', () => {
        it('calls preload on the streams', async () => {
            track = createTrack()
            await awaitContentTypes()
            const trackOptions: TrackPreloadOptions = {
                prefetchPriority: 3,
            }
            const loadOptions: TrackConfigOptions = {
                startTime: 4,
            }
            track.preload(trackOptions, loadOptions)
            expect(getAudioStream().preload).toHaveBeenCalledOnceWith({
                prefetchPriority: 3,
                startTime: 4,
            })
            expect(getVideoStream().preload).toHaveBeenCalledOnceWith({
                prefetchPriority: 3,
                startTime: 4,
            })
        })
    })

    describe('activate', () => {
        it('activates successfully', async () => {
            track = createTrack()
            await awaitContentTypes()
            expect(() => track!.activate({})).not.toThrow()
        })

        it('seeks to startTime', async () => {
            track = createTrack()
            await awaitContentTypes()
            track.activate({ startTime: 20 })
            expect(deps.playbackController.seekTo).toHaveBeenCalledOnceWith(20)
        })

        it('disables remote playback', async () => {
            track = createTrack()
            await awaitContentTypes()
            track.activate({})
            expect(deps.playbackSource.disableRemotePlayback).toBeTrue()
        })

        it('sets the src', async () => {
            deps.mediaSourceController.activate.and.returnValue('test1')
            track = createTrack()
            await awaitContentTypes()
            expect(deps.playbackSource.src).toBeNull()
            track.activate({})
            expect(deps.playbackSource.src).toBe('test1')
        })

        it('initializes the drm controller with the streaming metadata for audio and video', async () => {
            // Audio and video may have different content protections and both streams should provide their
            // encryption information to the drm controller on activate and streaming quality changes
            track = createTrack()
            await awaitContentTypes()
            const audioMetadata = createEmptyMediaQualityMetadata()
            const videoMetadata = createEmptyMediaQualityMetadata()
            getAudioStream().streamingQuality = audioMetadata
            getVideoStream().streamingQuality = videoMetadata
            track.activate({})
            expect(
                deps.drmController.initializeForPlayback
            ).toHaveBeenCalledTimes(2)
            expect(
                deps.drmController.initializeForPlayback
            ).toHaveBeenCalledWith(audioMetadata, {
                trackUri: 'uri',
                abort: any(Abort),
            })
            expect(
                deps.drmController.initializeForPlayback
            ).toHaveBeenCalledWith(videoMetadata, {
                trackUri: 'uri',
                abort: any(Abort),
            })
        })
    })

    describe('deactivate', () => {
        it('clears playback state', async () => {
            track = createTrack()
            await awaitContentTypes()
            track.activate({})
            track.deactivate()
            expect(deps.playbackSource.src).toBeNull()
            expect(deps.playbackSource.load).toHaveBeenCalledOnceWith()
            expect(deps.playbackController.pause).toHaveBeenCalledOnceWith()
        })

        it('clears the drm buffering info', async () => {
            track = createTrack()
            await awaitContentTypes()
            track.activate({})
            deps.drmController.setBufferingDrmInfo.calls.reset()
            track.deactivate()
            expect(
                deps.drmController.setBufferingDrmInfo
            ).toHaveBeenCalledOnceWith(null, {
                trackUri: 'uri',
                abort: any(Abort),
            })
        })
    })

    describe('error', () => {
        it('returns the first emitted error', async () => {
            track = createTrack()
            await awaitContentTypes()
            const error1 = new Error('expected')
            getAudioStream().dispatch('error', {
                error: error1,
                target: getAudioStream(),
            })
            expect(track.error).toBe(error1)

            // Second error does not override error state
            const error2 = new Error('not expected')
            getVideoStream().dispatch('error', {
                error: error2,
                target: getVideoStream(),
            })
            // Should still be error1 until reset
            expect(track.error).toBe(error1)

            track.reset()
            expect(track.error).toBeNull()

            getVideoStream().dispatch('error', {
                error: error2,
                target: getVideoStream(),
            })
            expect(track.error).toBe(error2)
        })
    })

    describe('when streamingQualityChange is emitted', () => {
        it('initializes drm controller protections when track is active', async () => {
            // drmController initialize creates and attaches media keys with the supported key system
            // and creates a new key session if PSSH init data is provided
            const { drmController } = deps
            const metadata1 = createEmptyMediaQualityMetadata()
            track = createTrack()
            await awaitContentTypes()
            getAudioStream().dispatch('streamingQualityChange', {
                previous: null,
                current: metadata1,
            })
            expect(drmController.initializeForPlayback).not.toHaveBeenCalled()

            track.activate({})
            // Clears calls from activate:
            drmController.initializeForPlayback.calls.reset()

            getAudioStream().dispatch('streamingQualityChange', {
                previous: null,
                current: metadata1,
            })
            expect(
                drmController.initializeForPlayback
            ).toHaveBeenCalledOnceWith(metadata1, {
                trackUri: 'uri',
                abort: any(Abort),
            })

            drmController.initializeForPlayback.calls.reset()

            const metadata2 = createEmptyMediaQualityMetadata()
            getVideoStream().dispatch('streamingQualityChange', {
                previous: null,
                current: metadata2,
            })
            expect(
                drmController.initializeForPlayback
            ).toHaveBeenCalledOnceWith(metadata2, {
                trackUri: 'uri',
                abort: any(Abort),
            })
        })
    })

    describe('when bufferingQualityChange is emitted', () => {
        it('updates drm content protections', async () => {
            const metadata = createEmptyMediaQualityMetadata()
            track = createTrack()
            await awaitContentTypes()
            getAudioStream().dispatch('bufferingQualityChange', {
                previous: null,
                current: metadata,
            })
            expect(
                deps.drmController.setBufferingDrmInfo
            ).toHaveBeenCalledOnceWith(metadata, {
                trackUri: 'uri',
                abort: any(Abort),
            })

            deps.drmController.setBufferingDrmInfo.calls.reset()

            getVideoStream().dispatch('bufferingQualityChange', {
                previous: null,
                current: metadata,
            })
            expect(
                deps.drmController.setBufferingDrmInfo
            ).toHaveBeenCalledOnceWith(metadata, {
                trackUri: 'uri',
                abort: any(Abort),
            })
        })

        it('keeps the drm info when a stream transiently clears its buffering quality', async () => {
            // A seek/clear nulls a stream's buffering quality; the DRM info must
            // be kept so another still-appending stream's `encrypted` event can
            // resolve it. It is cleared on deactivation instead.
            track = createTrack()
            await awaitContentTypes()
            getAudioStream().dispatch('bufferingQualityChange', {
                previous: createEmptyMediaQualityMetadata(),
                current: null,
            })
            expect(
                deps.drmController.setBufferingDrmInfo
            ).not.toHaveBeenCalled()
        })
    })

    describe('load span attribution', () => {
        it('stamps its own uri onto a manifest load span at the source', async () => {
            track = createTrack('track-a')
            await awaitContentTypes()
            const spy = createEventSpy(track, 'loadSpanMeasured')
            deps.manifestController.dispatch('loadSpanMeasured', {
                kind: 'manifest',
                startTime: 1,
                endTime: 2,
            })
            expect(spy).toHaveBeenCalledOnceWith({
                kind: 'manifest',
                startTime: 1,
                endTime: 2,
                trackUri: 'track-a',
            })
        })

        it('stamps its own uri onto a segment load span at the source', async () => {
            track = createTrack('track-a')
            await awaitContentTypes()
            const spy = createEventSpy(track, 'loadSpanMeasured')
            getAudioStream().dispatch('loadSpanMeasured', {
                kind: 'initSegment',
                startTime: 3,
                endTime: 4,
            })
            expect(spy).toHaveBeenCalledOnceWith({
                kind: 'initSegment',
                startTime: 3,
                endTime: 4,
                trackUri: 'track-a',
            })
        })
    })

    describe('getStreamingQuality', () => {
        it('returns the streaming quality for the given stream', async () => {
            track = createTrack()
            await awaitContentTypes()
            const quality = createEmptyMediaQualityMetadata()
            expect(track.getStreamingQuality('audio')).toBeNull()
            getStream('audio')!.streamingQuality = quality
            expect(track.getStreamingQuality('audio')).toBe(quality)

            expect(track.getStreamingQuality('video')).toBeNull()
            getStream('video')!.streamingQuality = quality
            expect(track.getStreamingQuality('video')).toBe(quality)
        })
    })

    describe('getBufferingQuality', () => {
        it('returns streamAudio.bufferingQuality', async () => {
            track = createTrack()
            await awaitContentTypes()
            const quality = createEmptyMediaQualityMetadata()
            expect(track.getBufferingQuality('audio')).toBeNull()
            getStream('audio')!.bufferingQuality = quality
            expect(track.getBufferingQuality('audio')).toBe(quality)

            expect(track.getBufferingQuality('video')).toBeNull()
            getStream('video')!.bufferingQuality = quality
            expect(track.getBufferingQuality('video')).toBe(quality)
        })
    })

    describe('getPlaybackQuality', () => {
        it('returns streamAudio.playbackQuality', async () => {
            track = createTrack()
            await awaitContentTypes()
            const quality = createEmptyMediaQualityMetadata()
            expect(track.getPlaybackQuality('audio')).toBeNull()
            getStream('audio')!.playbackQuality = quality
            expect(track.getPlaybackQuality('audio')).toBe(quality)

            expect(track.getPlaybackQuality('video')).toBeNull()
            getStream('video')!.playbackQuality = quality
            expect(track.getPlaybackQuality('video')).toBe(quality)
        })
    })

    describe('bufferingEnded', () => {
        it('returns true when all streams have ended buffering', async () => {
            track = createTrack()
            await awaitContentTypes()
            getAudioStream().bufferingEnded = true
            getVideoStream().bufferingEnded = true
            expect(track.bufferingEnded).toBe(true)
        })

        it('returns false when not all streams have ended buffering', async () => {
            track = createTrack()
            await awaitContentTypes()
            getAudioStream().bufferingEnded = true
            getVideoStream().bufferingEnded = false
            expect(track.bufferingEnded).toBe(false)
        })
    })

    describe('stalled-seek recovery nudge', () => {
        const clock = useMockTime()

        function fillStream(stream: MockContentStream): void {
            stream.hasData = true
            stream.dispatch('hasDataChange', { previous: false, current: true })
        }

        async function setup(): Promise<{
            audio: MockContentStream
            video: MockContentStream
        }> {
            deps.playbackController.seekTo.and.resolveTo(void 0)
            track = createTrack()
            await awaitContentTypes()
            return { audio: getAudioStream(), video: getVideoStream() }
        }

        it('nudges the playhead when all streams have data but the seek is still stuck', async () => {
            const { audio, video } = await setup()
            deps.playbackController.seeking = true
            deps.playbackController.currentTime = 30
            fillStream(audio)
            // Only one stream has data — nothing scheduled yet.
            fillStream(video)
            expect(deps.playbackController.seekTo).not.toHaveBeenCalled()

            await clock.tick(SEEKING_STALL_TIME_CHECK * 1000)
            expect(deps.playbackController.seekTo).toHaveBeenCalledOnceWith(
                30 + PLAYHEAD_NUDGE,
                0
            )
        })

        it('does not nudge if the seek completes before the check fires', async () => {
            const { audio, video } = await setup()
            deps.playbackController.seeking = true
            fillStream(audio)
            fillStream(video)
            deps.playbackController.seeking = false
            await clock.tick(SEEKING_STALL_TIME_CHECK * 1000)
            expect(deps.playbackController.seekTo).not.toHaveBeenCalled()
        })

        it('does not nudge until every stream has data', async () => {
            const { audio } = await setup()
            deps.playbackController.seeking = true
            fillStream(audio)
            await clock.tick(SEEKING_STALL_TIME_CHECK * 1000)
            expect(deps.playbackController.seekTo).not.toHaveBeenCalled()
        })

        it('does not nudge if a stream loses its data before the check fires', async () => {
            const { audio, video } = await setup()
            deps.playbackController.seeking = true
            fillStream(audio)
            fillStream(video)
            // A stream's buffer was cleared during the wait window.
            video.hasData = false
            await clock.tick(SEEKING_STALL_TIME_CHECK * 1000)
            expect(deps.playbackController.seekTo).not.toHaveBeenCalled()
        })

        it('does not nudge when not seeking', async () => {
            const { audio, video } = await setup()
            deps.playbackController.seeking = false
            fillStream(audio)
            fillStream(video)
            await clock.tick(SEEKING_STALL_TIME_CHECK * 1000)
            expect(deps.playbackController.seekTo).not.toHaveBeenCalled()
        })

        it('does not nudge after the track is disposed', async () => {
            const { audio, video } = await setup()
            deps.playbackController.seeking = true
            fillStream(audio)
            fillStream(video)
            track!.dispose()
            await clock.tick(SEEKING_STALL_TIME_CHECK * 1000)
            expect(deps.playbackController.seekTo).not.toHaveBeenCalled()
        })
    })

    describe('checkBufferingEnded', () => {
        it('calls endOfStream and dispatches bufferingEnded when all streams are done', async () => {
            track = createTrack()
            await awaitContentTypes()
            getAudioStream().bufferingEnded = true
            getVideoStream().bufferingEnded = true

            const bufferingEndedSpy = createEventSpy(track, 'bufferingEnded')

            // Trigger checkBufferingEnded by dispatching bufferingEnded from a stream
            getAudioStream().dispatch('bufferingEnded', {})

            expect(
                deps.mediaSourceController.endOfStream
            ).toHaveBeenCalledOnceWith()
            expect(bufferingEndedSpy).toHaveBeenCalledOnceWith({})
        })

        it('does not call endOfStream when not all streams are done', async () => {
            track = createTrack()
            await awaitContentTypes()
            getAudioStream().bufferingEnded = false
            getVideoStream().bufferingEnded = true

            const bufferingEndedSpy = createEventSpy(track, 'bufferingEnded')

            // Trigger checkBufferingEnded by dispatching bufferingEnded from a stream
            getVideoStream().dispatch('bufferingEnded', {})

            expect(
                deps.mediaSourceController.endOfStream
            ).not.toHaveBeenCalled()
            expect(bufferingEndedSpy).not.toHaveBeenCalled()
        })
    })

    describe('dispose', () => {
        it('clears streams and calls super dispose', async () => {
            track = createTrack()
            await awaitContentTypes()
            const audioStream = getAudioStream()
            const videoStream = getVideoStream()

            track.dispose()

            expect(audioStream.dispose).toHaveBeenCalledOnceWith()
            expect(videoStream.dispose).toHaveBeenCalledOnceWith()
            expect(track.disposed).toBe(true)
        })
    })

    describe('when contentTypesValue promise rejects', () => {
        it('emits an error event', async () => {
            const expectedError = new Error('contentTypes failed')
            deps.contentTypesValue.value = Promise.reject(expectedError)

            track = createTrack()
            const errorSpy = createEventSpy(track, 'error')

            await flushPromises()
            expect(errorSpy).toHaveBeenCalledOnceWith({
                target: track,
                error: expectedError,
            })
        })
    })

    describe('when contentTypesValue changes', () => {
        describe('and content types are not equal', () => {
            it('clears and recreates the streams', async () => {
                track = createTrack()
                await awaitContentTypes()
                const streamsBeforeChange = getAllStreams()
                expect(streamsBeforeChange.length).toBe(2)
                deps.contentStreamFactory.calls.reset()
                deps.contentTypesValue.value = Promise.resolve(
                    new Set(['audio'])
                )
                await awaitContentTypes()
                for (const stream of streamsBeforeChange) {
                    expect(stream.dispose).toHaveBeenCalled()
                }
                expect(getAllStreams().length).toBe(1)
                expect(getAllStreams()[0].contentType).toBe('audio')
            })

            it('emits contentTypesChange event', async () => {
                track = createTrack()
                const contentTypesChangeSpy = createEventSpy(
                    track,
                    'contentTypesChange'
                )
                await awaitContentTypes()
                contentTypesChangeSpy.calls.reset() // Reset after initial setup
                const previousContentTypes = track.contentTypes
                deps.contentTypesValue.value = Promise.resolve(
                    new Set(['audio'])
                )
                await awaitContentTypes()
                expect(contentTypesChangeSpy).toHaveBeenCalledOnceWith({
                    previous: previousContentTypes,
                    current: new Set(['audio']),
                })
            })
        })

        describe('and content types are equal', () => {
            it('does not recreate the streams', async () => {
                track = createTrack()
                await awaitContentTypes()
                const streamsBeforeChange = getAllStreams()
                expect(streamsBeforeChange.length).toBe(2)
                deps.contentStreamFactory.calls.reset()
                deps.contentTypesValue.value = Promise.resolve(
                    new Set(['video', 'audio']) // order does not matter
                )
                await awaitContentTypes()
                for (const stream of streamsBeforeChange) {
                    expect(stream.dispose).not.toHaveBeenCalled()
                }
                expect(deps.contentStreamFactory).not.toHaveBeenCalled()
            })
        })
    })

    describe('stream creation after preload/activate', () => {
        it('calls preload on new streams when lastPreloadOptions exists', async () => {
            track = createTrack()

            // Call preload before streams are created
            track.preload({ prefetchPriority: 5 }, { startTime: 10 })

            // Now create streams
            await awaitContentTypes()

            expect(getAudioStream().preload).toHaveBeenCalledWith({
                prefetchPriority: 5,
                startTime: 10,
            })
            expect(getVideoStream().preload).toHaveBeenCalledWith({
                prefetchPriority: 5,
                startTime: 10,
            })
        })

        it('calls activate on new streams when activateOptions exists', async () => {
            track = createTrack()

            // Call activate before streams are created
            track.activate({ startTime: 15 })

            // Now create streams
            await awaitContentTypes()

            expect(getAudioStream().activate).toHaveBeenCalledWith({
                startTime: 15,
            })
            expect(getVideoStream().activate).toHaveBeenCalledWith({
                startTime: 15,
            })
        })
    })

    describe('qualities', () => {
        const qualityMetadata = {
            ...createEmptyMediaQualityMetadata(),
            contentType: 'audio' as const,
            qualityId: 'q1',
        }
        const qualityMetadata2 = {
            ...createEmptyMediaQualityMetadata(),
            contentType: 'audio' as const,
            qualityId: 'q2',
        }

        // Sets the raw and (optionally) the filtered/transformed timelines. They
        // default to the same timeline; pass a distinct `transformed` to model
        // the language/codec filter narrowing the playable set.
        function setTimeline(
            timeline: MediaTimeline,
            transformed: MediaTimeline = timeline
        ) {
            deps.mediaTimeline.value = Promise.resolve(timeline)
            deps.mediaTimelineTransformed.value = Promise.resolve(transformed)
        }

        it('returns null when timeline has no periods', () => {
            track = createTrack()
            expect(track.qualities).toBeNull()
            expect(track.qualitiesUnfiltered).toBeNull()
        })

        it('exposes qualities from the current period', async () => {
            setTimeline({
                periods: [
                    {
                        startTime: 0,
                        endTime: 100,
                        qualities: [
                            {
                                metadata: qualityMetadata,
                                getSegment: () => Promise.resolve(null),
                            },
                        ],
                    },
                ],
                minBufferTime: 2,
                getAdBreaks: () => Promise.resolve([]),
                getDuration: () => Promise.resolve(Infinity),
            })
            track = createTrack()
            await flushPromises()
            expect(track.qualities).toEqual([qualityMetadata])
            expect(track.qualitiesUnfiltered).toEqual([qualityMetadata])
        })

        it('reads qualities from the filtered timeline but qualitiesUnfiltered from the raw one', async () => {
            // The transformed timeline is filtered (e.g. by preferred audio
            // language) down to one quality; the raw timeline keeps them all.
            // `qualitiesUnfiltered` must reflect the RAW timeline so consumers
            // (e.g. a language picker) still see every option.
            const makeTimeline = (
                qualities: (typeof qualityMetadata)[]
            ): MediaTimeline => ({
                periods: [
                    {
                        startTime: 0,
                        endTime: 100,
                        qualities: qualities.map((metadata) => ({
                            metadata,
                            getSegment: () => Promise.resolve(null),
                        })),
                    },
                ],
                minBufferTime: 2,
                getAdBreaks: () => Promise.resolve([]),
                getDuration: () => Promise.resolve(Infinity),
            })
            setTimeline(
                makeTimeline([qualityMetadata, qualityMetadata2]),
                makeTimeline([qualityMetadata])
            )
            track = createTrack()
            await flushPromises()
            expect(track.qualities).toEqual([qualityMetadata])
            expect(track.qualitiesUnfiltered).toEqual([
                qualityMetadata,
                qualityMetadata2,
            ])
        })

        it('dispatches qualitiesChange event', async () => {
            setTimeline({
                periods: [
                    {
                        startTime: 0,
                        endTime: 100,
                        qualities: [
                            {
                                metadata: qualityMetadata,
                                getSegment: () => Promise.resolve(null),
                            },
                        ],
                    },
                ],
                minBufferTime: 2,
                getAdBreaks: () => Promise.resolve([]),
                getDuration: () => Promise.resolve(Infinity),
            })
            track = createTrack()
            const spy = createEventSpy(track, 'qualitiesChange')
            await flushPromises()
            expect(spy).toHaveBeenCalledOnceWith({
                previous: [],
                current: [qualityMetadata],
            })
        })

        it('updates qualities on period change via timeUpdate', async () => {
            const timeline: MediaTimeline = {
                periods: [
                    {
                        startTime: 0,
                        endTime: 50,
                        qualities: [
                            {
                                metadata: qualityMetadata,
                                getSegment: () => Promise.resolve(null),
                            },
                        ],
                    },
                    {
                        startTime: 50,
                        endTime: 100,
                        qualities: [
                            {
                                metadata: qualityMetadata2,
                                getSegment: () => Promise.resolve(null),
                            },
                        ],
                    },
                ],
                minBufferTime: 2,
                getAdBreaks: () => Promise.resolve([]),
                getDuration: () => Promise.resolve(Infinity),
            }
            setTimeline(timeline)
            track = createTrack()
            await flushPromises()
            expect(track.qualities).toEqual([qualityMetadata])

            // Activate to get timeUpdate listener
            track.activate({})
            await flushPromises()

            // Move to second period
            deps.playbackController.currentTime = 55
            deps.playbackController.dispatch('timeUpdate', {
                previous: 0,
                current: 55,
            })
            await flushPromises()
            expect(track.qualities).toEqual([qualityMetadata2])
        })

        it('skips update when period has not changed', async () => {
            setTimeline({
                periods: [
                    {
                        startTime: 0,
                        endTime: 100,
                        qualities: [
                            {
                                metadata: qualityMetadata,
                                getSegment: () => Promise.resolve(null),
                            },
                        ],
                    },
                ],
                minBufferTime: 2,
                getAdBreaks: () => Promise.resolve([]),
                getDuration: () => Promise.resolve(Infinity),
            })
            track = createTrack()
            await flushPromises()
            track.activate({})
            await flushPromises()

            const spy = createEventSpy(track, 'qualitiesChange')
            deps.playbackController.currentTime = 10
            deps.playbackController.dispatch('timeUpdate', {
                previous: 0,
                current: 10,
            })
            await flushPromises()
            // Same period, no event
            expect(spy).not.toHaveBeenCalled()
        })
    })

    describe('textTrackController', () => {
        it('returns null when no controller is provided', () => {
            track = new MseTrack(
                'uri',
                'mse',
                externalDependencies({ ...deps, textTrackController: null })
            )
            expect(track.textTrackController).toBeNull()
        })

        it('returns the dependency-provided controller', () => {
            track = createTrack()
            expect(track.textTrackController).toBe(deps.textTrackController)
        })

        it('suspends the controller on deactivate and resumes it on activate', () => {
            track = createTrack()
            track.activate({})
            expect(deps.textTrackController.resume).toHaveBeenCalled()
            track.deactivate()
            expect(deps.textTrackController.suspend).toHaveBeenCalled()
        })

        // Regression: reading a disposed track's controller threw DisposedError
        // (disposed DI-container lazy). An ad track evicted mid-break is still
        // the outgoing track on the track change that resumes content, and
        // the player reads its textTrackController — the throw stalled the ad.
        it('returns null (not throw) when read after disposal', () => {
            const t = (track = createTrack())
            expect(t.textTrackController).toBe(deps.textTrackController)
            t.dispose()
            expect(() => t.textTrackController).not.toThrow()
            expect(t.textTrackController).toBeNull()
        })

        it('does not throw when its activate/deactivate hooks run after disposal', () => {
            const t = (track = createTrack())
            t.dispose()
            expect(() => t.onDeactivated()).not.toThrow()
            expect(() => t.onActivated({})).not.toThrow()
        })
    })

    describe('seekRange', () => {
        // Sets the raw and (optionally) the filtered/transformed timelines. They
        // default to the same timeline; pass a distinct `transformed` to model
        // the language/codec filter narrowing the playable set.
        function setTimeline(
            timeline: MediaTimeline,
            transformed: MediaTimeline = timeline
        ) {
            deps.mediaTimeline.value = Promise.resolve(timeline)
            deps.mediaTimelineTransformed.value = Promise.resolve(transformed)
        }

        it('is null initially', () => {
            track = createTrack()
            expect(track.seekRange).toBeNull()
        })

        it('resolves from the media timeline duration', async () => {
            setTimeline({
                periods: [
                    {
                        startTime: 0,
                        endTime: 120,
                        qualities: [],
                    },
                ],
                minBufferTime: 2,
                getAdBreaks: () => Promise.resolve([]),
                getDuration: () => Promise.resolve(120),
            })
            track = createTrack()
            await flushPromises()
            expect(track.seekRange).toEqual({ start: 0, end: 120 })
        })

        it('dispatches seekRangeChange when the range resolves', async () => {
            setTimeline({
                periods: [
                    {
                        startTime: 0,
                        endTime: 60,
                        qualities: [],
                    },
                ],
                minBufferTime: 2,
                getAdBreaks: () => Promise.resolve([]),
                getDuration: () => Promise.resolve(60),
            })
            track = createTrack()
            const spy = createEventSpy(track, 'seekRangeChange')
            await flushPromises()
            expect(spy).toHaveBeenCalledWith(
                jasmine.objectContaining({
                    previous: null,
                    current: { start: 0, end: 60 },
                })
            )
        })

        it('returns Infinity end for live streams', async () => {
            setTimeline({
                periods: [
                    {
                        startTime: 0,
                        endTime: Infinity,
                        qualities: [],
                    },
                ],
                minBufferTime: 2,
                getAdBreaks: () => Promise.resolve([]),
                getDuration: () => Promise.resolve(Infinity),
            })
            track = createTrack()
            await flushPromises()
            expect(track.seekRange).toEqual({ start: 0, end: Infinity })
        })

        it('does not dispatch when range is unchanged', async () => {
            const timeline: MediaTimeline = {
                periods: [
                    {
                        startTime: 0,
                        endTime: 60,
                        qualities: [],
                    },
                ],
                minBufferTime: 2,
                getAdBreaks: () => Promise.resolve([]),
                getDuration: () => Promise.resolve(60),
            }
            deps.mediaTimeline.value = Promise.resolve(timeline)
            deps.mediaTimelineTransformed.value = Promise.resolve(timeline)
            track = createTrack()
            await flushPromises()
            expect(track.seekRange).toEqual({ start: 0, end: 60 })

            const spy = createEventSpy(track, 'seekRangeChange')
            // Re-emit the same timeline
            deps.mediaTimeline.value = Promise.resolve(timeline)
            await flushPromises()
            expect(spy).not.toHaveBeenCalled()
        })

        it('does not update seekRange if disposed during getDuration', async () => {
            let resolveDuration!: (v: number) => void
            const timeline: MediaTimeline = {
                periods: [{ startTime: 0, endTime: 60, qualities: [] }],
                minBufferTime: 2,
                getAdBreaks: () => Promise.resolve([]),
                getDuration: () =>
                    new Promise((r) => {
                        resolveDuration = r
                    }),
            }
            deps.mediaTimeline.value = Promise.resolve(timeline)
            deps.mediaTimelineTransformed.value = Promise.resolve(timeline)
            track = createTrack()
            await flushPromises()
            // Dispose before getDuration resolves
            track.dispose()
            resolveDuration(60)
            await flushPromises()
            expect(track.seekRange).toBeNull()
        })
    })

    describe('ads', () => {
        // Sets the raw and (optionally) the filtered/transformed timelines. They
        // default to the same timeline; pass a distinct `transformed` to model
        // the language/codec filter narrowing the playable set.
        function setTimeline(
            timeline: MediaTimeline,
            transformed: MediaTimeline = timeline
        ) {
            deps.mediaTimeline.value = Promise.resolve(timeline)
            deps.mediaTimelineTransformed.value = Promise.resolve(transformed)
        }

        function makeTimeline(adBreaks: AdBreakList): MediaTimeline {
            return {
                periods: [],
                minBufferTime: 2,
                getAdBreaks: () => Promise.resolve(adBreaks),
                getDuration: () => Promise.resolve(Infinity),
            }
        }

        const sampleAdBreaks: AdBreakList = [
            {
                id: 'b1',
                startTime: 10,
                duration: 5,
                placement: 'midroll',
                restrict: {},
                once: false,
                resumeOffset: null,
                playoutLimit: null,
                resolutionTimeOffset: null,
                skipControl: () => null,
                ads: () =>
                    Promise.resolve([
                        {
                            id: 'a1',
                            startTime: 10,
                            duration: 5,
                            uri: 'ad.m3u8',
                        },
                    ]),
            },
        ]

        it('resolves discovered ad breaks from the current timeline', async () => {
            setTimeline(makeTimeline(sampleAdBreaks))
            track = createTrack()
            expect(await track.getAds()).toEqual({
                trackUri: track.uri,
                adBreaks: sampleAdBreaks,
            })
        })

        it('resolves an empty ad break list when the timeline has none', async () => {
            setTimeline(makeTimeline([]))
            track = createTrack()
            expect((await track.getAds()).adBreaks).toEqual([])
        })

        it('dispatches adsChange when the transformed timeline updates', async () => {
            setTimeline(makeTimeline(sampleAdBreaks))
            track = createTrack()
            const spy = createEventSpy(track, 'adsChange')
            // A subsequent transformed-timeline emission re-signals that the
            // track's ads may have changed; consumers re-read via getAds().
            deps.mediaTimelineTransformed.value = Promise.resolve(
                makeTimeline(sampleAdBreaks)
            )
            await flushPromises()
            expect(spy).toHaveBeenCalled()
        })

        it('reflects the current timeline on each getAds call (no stale cache)', async () => {
            setTimeline(makeTimeline([]))
            track = createTrack()
            expect((await track.getAds()).adBreaks).toEqual([])
            // The timeline changes; getAds() awaits the current value, so a
            // later call reflects the new breaks rather than a cached result.
            deps.mediaTimeline.value = Promise.resolve(
                makeTimeline(sampleAdBreaks)
            )
            expect((await track.getAds()).adBreaks).toEqual(sampleAdBreaks)
        })
    })

    describe('option-driven stream effects', () => {
        beforeEach(async () => {
            track = createTrack()
            await awaitContentTypes()
        })

        it('does not react to the initial option values on construction', () => {
            // Each binding is guarded on previous === undefined, so the initial
            // emission during construction must not rebuild the track.
            expect(deps.manifestController.reset).not.toHaveBeenCalled()
            expect(getAudioStream().reset).not.toHaveBeenCalled()
        })

        // A shared array reference so re-applying it reads as unchanged.
        const allowed: readonly RestrictableContentType[] = ['audio']
        for (const scenario of [
            {
                name: 'preferredAudioLanguage',
                apply: () => (deps.preferredAudioLanguage.value = 'ja'),
            },
            {
                name: 'allowedContentTypes',
                apply: () => (deps.allowedContentTypes.value = allowed),
            },
            {
                name: 'preferDescriptiveAudio',
                apply: () => (deps.preferDescriptiveAudio.value = true),
            },
        ]) {
            describe(`when ${scenario.name} changes`, () => {
                it('clears prefetch and hard-resets this track', () => {
                    const clearSpy = spyOn(track!, 'clearPrefetch')
                    const resetSpy = spyOn(track!, 'reset')
                    scenario.apply()
                    expect(clearSpy).toHaveBeenCalledOnceWith()
                    expect(resetSpy).toHaveBeenCalledOnceWith(true)
                })

                it('does not react when the value is unchanged', () => {
                    scenario.apply()
                    const clearSpy = spyOn(track!, 'clearPrefetch')
                    const resetSpy = spyOn(track!, 'reset')
                    // Re-applying the identical value is not a change.
                    scenario.apply()
                    expect(clearSpy).not.toHaveBeenCalled()
                    expect(resetSpy).not.toHaveBeenCalled()
                })
            })
        }

        describe('when abr resolution restrictions change', () => {
            it('clears prefetch (without a rebuild) when maxHeight changes', () => {
                const clearSpy = spyOn(track!, 'clearPrefetch')
                const resetSpy = spyOn(track!, 'reset')
                deps.abr.value = { ...deps.abr.value, maxHeight: 480 }
                expect(clearSpy).toHaveBeenCalledOnceWith()
                // The same streams just re-select a quality — no stream rebuild.
                expect(resetSpy).not.toHaveBeenCalled()
            })

            it('clears prefetch when maxWidth changes', () => {
                const clearSpy = spyOn(track!, 'clearPrefetch')
                deps.abr.value = { ...deps.abr.value, maxWidth: 640 }
                expect(clearSpy).toHaveBeenCalledOnceWith()
            })

            it('does not clear prefetch for a non-restriction abr change', () => {
                const clearSpy = spyOn(track!, 'clearPrefetch')
                deps.abr.value = {
                    ...deps.abr.value,
                    highBufferThreshold: 42,
                }
                expect(clearSpy).not.toHaveBeenCalled()
            })
        })
    })
})
