/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createEmptyMediaQualityMetadata,
    DrmKeySystem,
    type MediaQualityMetadata,
    PlaybackReadyState,
    SourceTrackBase,
    TrackBase,
    type TrackBaseDeps,
    type TrackUri,
} from '@amazon/vinyl'
import { Abort, Deferred } from '@amazon/vinyl-util'
import {
    MockDrmController,
    MockPlaybackController,
} from '@amazon/vinyl/vinylTestUtil'
import { createEventSpy, useMockLogger } from '@amazon/vinyl-util/testUtil'
import {
    expectNothing,
    expectPrototype,
    flushPromises,
} from '@amazon/vinyl-util/browserTestUtil'
import objectContaining = jasmine.objectContaining
import createSpy = jasmine.createSpy
import any = jasmine.any

class TestSourceTrackBase extends SourceTrackBase<any> {
    constructor(uri: TrackUri, src: Promise<any>, deps: TrackBaseDeps) {
        super(uri, 'testSrc', src, deps)
    }
    clearSrc = createSpy('clearSrc')
    setSrc = createSpy('setSrc')
    reset = createSpy('reset')
}

describe('SourceTrackBase', () => {
    const mockLogger = useMockLogger()
    let playbackController: MockPlaybackController
    let drmController: MockDrmController
    let promise: Deferred<any>
    let track: TestSourceTrackBase

    function createSourceTrack(uri = 'uri') {
        return new TestSourceTrackBase(uri, promise, {
            playbackController,
            drmController,
        })
    }

    beforeEach(() => {
        playbackController = new MockPlaybackController()
        playbackController.seekTo.and.resolveTo(void 0)
        drmController = new MockDrmController()
        promise = new Deferred<any>()
        track = createSourceTrack()
    })

    it('is an instance of BaseTrack', () => {
        expectPrototype(() => createSourceTrack(), SourceTrackBase, TrackBase)
    })

    it('exposes a null textTrackController by default', () => {
        expect(track.textTrackController).toBeNull()
    })

    describe('when src promise rejects', () => {
        it('emits an error event', async () => {
            const errorSpy = createEventSpy(track, 'error')
            const error = new Error('expected')
            promise.reject(error)
            await flushPromises()
            expect(track.setSrc).not.toHaveBeenCalled()
            expect(errorSpy).toHaveBeenCalledOnceWith({
                target: track,
                error,
            })
        })
    })

    describe('activate', () => {
        describe('when src promise is resolved', () => {
            beforeEach(async () => {
                promise.resolve('test')
                await promise
            })

            it('provides src to setSrc', async () => {
                expect(track.setSrc).not.toHaveBeenCalled()
                track.activate({})
                await flushPromises()
                expect(track.setSrc).toHaveBeenCalledOnceWith('test')
            })
        })

        describe('when promise is pending', () => {
            describe('and promise then resolves', () => {
                it('calls setSrc', async () => {
                    expect(track.setSrc).not.toHaveBeenCalled()
                    track.activate({})
                    promise.resolve('test')
                    await promise
                    expect(track.setSrc).toHaveBeenCalledOnceWith('test')
                })
            })
        })
    })

    describe('when promise is resolved after track has been activated and deactivated', () => {
        it('does not set or clear src', () => {
            track.activate({})
            track.deactivate()
            promise.resolve('test')
            expect(track.setSrc).not.toHaveBeenCalled()
            expect(track.clearSrc).not.toHaveBeenCalled()
        })
    })

    describe('deactivate', () => {
        describe('when promise is resolved', () => {
            beforeEach(async () => {
                promise.resolve('test')
                await promise
            })

            it('calls clearSrc', () => {
                track.activate({})
                track.deactivate()
                expect(track.clearSrc).toHaveBeenCalledOnceWith()
            })
        })

        describe('when promise is rejected', () => {
            it('emits an error event', async () => {
                const errorSpy = createEventSpy(track, 'error')
                promise.reject(new Error('expected'))
                await flushPromises()
                track.activate({})
                track.deactivate()
                await flushPromises()
                expect(errorSpy).toHaveBeenCalledOnceWith(
                    objectContaining({
                        target: track,
                        error: new Error('expected'),
                    })
                )
                expect(track.setSrc).not.toHaveBeenCalled()
            })
        })
    })

    describe('preload', () => {
        it('applies loadOptions qualityMetadata to fixed quality', () => {
            track.preload(
                { prefetchPriority: 0 },
                {
                    qualityMetadata: {
                        decoderId: 'decoder-id-1',
                        contentType: 'audio',
                    },
                }
            )
            track.activate({})
            expect(track.getBufferingQuality('audio')?.decoderId).toBe(
                'decoder-id-1'
            )
        })
    })

    describe('contentTypes', () => {
        it('returns content types from fixed playback quality', () => {
            track.preload(
                { prefetchPriority: 0 },
                {
                    qualityMetadata: {
                        decoderId: 'test-decoder',
                        contentType: 'audio',
                    },
                }
            )
            expect(track.contentTypes).toEqual(new Set(['audio']))
        })
    })

    describe('getStreamingQuality', () => {
        it('is a fixed quality', () => {
            track.preload(
                { prefetchPriority: 0 },
                {
                    qualityMetadata: {
                        decoderId: 'test-decoder',
                        contentType: 'audio',
                    },
                }
            )
            expect(track.getStreamingQuality('audio')).not.toBeNull()
        })

        it('returns null for non-matching content type', () => {
            track.preload(
                { prefetchPriority: 0 },
                {
                    qualityMetadata: {
                        decoderId: 'test-decoder',
                        contentType: 'audio',
                    },
                }
            )
            expect(track.getStreamingQuality('video')).toBeNull()
        })
    })

    describe('getBufferingQuality', () => {
        it('is a fixed quality when track is activated', () => {
            track.preload(
                { prefetchPriority: 0 },
                {
                    qualityMetadata: {
                        decoderId: 'test-decoder',
                        contentType: 'audio',
                    },
                }
            )
            expect(track.getBufferingQuality('audio')).toBeNull() // Not active
            track.activate({})
            expect(track.getBufferingQuality('audio')).not.toBeNull()
        })
    })

    describe('getPlaybackQuality', () => {
        it('is a fixed quality when track has data buffered', () => {
            track.preload(
                { prefetchPriority: 0 },
                {
                    qualityMetadata: {
                        decoderId: 'test-decoder',
                        contentType: 'audio',
                    },
                }
            )
            expect(track.getPlaybackQuality('audio')).toBeNull() // Not active
            track.activate({})
            expect(track.getPlaybackQuality('audio')).toBeNull() // Nothing buffered
            playbackController.readyState = PlaybackReadyState.HAVE_FUTURE_DATA
            playbackController.dispatch('readyStateChange', {
                previous: null,
                current: PlaybackReadyState.HAVE_FUTURE_DATA,
            })
            expect(track.getPlaybackQuality('audio')).toEqual(
                objectContaining({
                    ...createEmptyMediaQualityMetadata(),
                    contentType: 'audio',
                    decoderId: 'test-decoder',
                    qualityId: any(String),
                    groupId: any(String),
                })
            )
        })
    })

    describe('when track is configured and metadata has encryption', () => {
        it('initializes drm controller protections when active', () => {
            // drmController initialize creates and attaches media keys with the supported key system
            // and creates a new key session if PSSH init data is provided
            const metadata: MediaQualityMetadata = {
                ...createEmptyMediaQualityMetadata(),
                mimeType: 'audio/mp4',
                contentType: 'audio',
                contentProtections: [
                    {
                        keySystem: DrmKeySystem.WIDEVINE,
                    },
                ],
            }
            track.preload(
                { prefetchPriority: 0 },
                {
                    qualityMetadata: metadata,
                }
            )
            expect(drmController.initializeForPlayback).not.toHaveBeenCalled()
            expect(drmController.setBufferingDrmInfo).not.toHaveBeenCalled()
            track.activate({})
            expect(
                drmController.initializeForPlayback
            ).toHaveBeenCalledOnceWith(metadata, any(Abort))
            expect(drmController.setBufferingDrmInfo).toHaveBeenCalledOnceWith(
                metadata,
                any(Abort)
            )
            drmController.setBufferingDrmInfo.calls.reset()
            track.deactivate()
            expect(drmController.setBufferingDrmInfo).toHaveBeenCalledOnceWith(
                null,
                any(Abort)
            )
        })
    })

    describe('clearPrefetch', () => {
        it('logs a message', () => {
            track.clearPrefetch()
            expect(mockLogger.value.debug).toHaveBeenCalledTimes(1)
        })
    })

    describe('reset', () => {
        it('does nothing', () => {
            track.reset()
            expectNothing()
        })
    })

    it('returns null for qualities', () => {
        track = createSourceTrack()
        expect(track.qualities).toBeNull()
        expect(track.qualitiesUnfiltered).toBeNull()
    })
})
