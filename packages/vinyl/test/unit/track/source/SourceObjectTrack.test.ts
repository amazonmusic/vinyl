/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createSourceObjectTrackFactory,
    SourceObjectTrack,
    type SourceObjectTrackLoadOptions,
    type TrackFactory,
    type TrackTypeId,
    type TrackUri,
} from '@amazon/vinyl'
import { Deferred } from '@amazon/vinyl-util'
import {
    flushPromises,
    MockMediaStream,
} from '@amazon/vinyl-util/browserTestUtil'
import {
    MockDrmController,
    MockPlaybackController,
    MockPlaybackSource,
} from '@amazon/vinyl/vinylTestUtil'

import { useMockLogger } from '@amazon/vinyl-util/testUtil'

describe('SourceObjectTrack', () => {
    useMockLogger()
    let mediaStream: MockMediaStream
    let playbackController: MockPlaybackController
    let playbackSource: MockPlaybackSource
    let drmController: MockDrmController
    let promise: Deferred<MediaStream>
    let track: SourceObjectTrack

    function createSourceObjectTrack(
        uri: TrackUri = 'uri',
        type: TrackTypeId = 'srcObject'
    ) {
        return new SourceObjectTrack(uri, type, promise, {
            playbackController,
            playbackSource,
            drmController,
        })
    }

    beforeEach(() => {
        mediaStream = new MockMediaStream()
        playbackController = new MockPlaybackController()
        playbackController.seekTo.and.resolveTo(void 0)
        playbackSource = new MockPlaybackSource()
        drmController = new MockDrmController()
        promise = new Deferred<MediaStream>()
        track = createSourceObjectTrack()
    })

    describe('activate', () => {
        describe('when promise is resolved', () => {
            beforeEach(async () => {
                promise.resolve(mediaStream)
                await promise
            })

            it('sets srcObject on PlaybackSource', async () => {
                expect(playbackSource.srcObject).toBeNull()
                track.activate({})
                await flushPromises()
                expect(playbackSource.srcObject).toBe(mediaStream)
            })
        })
    })

    describe('deactivate', () => {
        describe('when promise is resolved', () => {
            beforeEach(async () => {
                promise.resolve(mediaStream)
                await promise
            })

            it('sets src to null on PlaybackSource and calls load', () => {
                track.activate({})
                track.deactivate()
                expect(playbackSource.srcObject).toBe(null)
                expect(playbackSource.load).toHaveBeenCalledOnceWith()
            })
        })
    })

    describe('toString', () => {
        it('contains the uri', () => {
            expect(track.toString()).toContain(track.uri)
            expect(track.toString()).toContain('SourceObjectTrack')
        })
    })
})

describe('createSourceTrackFactory', () => {
    let trackFactory: TrackFactory<SourceObjectTrackLoadOptions>

    beforeEach(() => {
        trackFactory = createSourceObjectTrackFactory({
            playbackController: new MockPlaybackController(),
            playbackSource: new MockPlaybackSource(),
            drmController: new MockDrmController(),
        })
    })

    it('creates a track factory for SourceTrack', () => {
        const track = trackFactory.createTrack({
            type: 'srcObject',
            uri: 'test',
            srcObjectProvider: () => new MockMediaStream(),
        })
        expect(track).toBeInstanceOf(SourceObjectTrack)
    })

    it('validates the track options', () => {
        expect(() =>
            trackFactory.validate(
                // @ts-expect-error Expected validation error
                {
                    type: 'srcObject',
                    uri: 'test',
                }
            )
        ).toThrowError(`property 'srcObjectProvider' is required`)

        expect(() =>
            trackFactory.validate({
                type: 'srcObject',
                uri: 'test',
                srcObjectProvider: () => new MockMediaStream(),
                config: {
                    // @ts-expect-error Expected number
                    startTime: '42',
                },
            })
        ).toThrowError(
            `Expected: (type number | nullish), but was: "42". At: config.startTime`
        )
    })
})
