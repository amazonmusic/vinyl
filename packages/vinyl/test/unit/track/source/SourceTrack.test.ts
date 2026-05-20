/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createSourceTrackFactory,
    SourceTrack,
    type SourceTrackLoadOptions,
    type TrackFactory,
    type TrackTypeId,
    type TrackUri,
} from '@amazon/vinyl'
import { Deferred } from '@amazon/vinyl-util'
import { flushPromises } from '@amazon/vinyl-util/browserTestUtil'
import {
    MockDrmController,
    MockPlaybackController,
    MockPlaybackSource,
} from '@amazon/vinyl/vinylTestUtil'

import { useMockLogger } from '@amazon/vinyl-util/testUtil'

describe('SourceTrack', () => {
    useMockLogger()
    let playbackController: MockPlaybackController
    let playbackSource: MockPlaybackSource
    let drmController: MockDrmController
    let promise: Deferred<string>
    let track: SourceTrack

    function createSourceTrack(
        uri: TrackUri = 'uri',
        type: TrackTypeId = 'src'
    ) {
        return new SourceTrack(uri, type, promise, {
            playbackController,
            playbackSource,
            drmController,
        })
    }

    beforeEach(() => {
        playbackController = new MockPlaybackController()
        playbackController.seekTo.and.resolveTo(void 0)
        playbackSource = new MockPlaybackSource()
        drmController = new MockDrmController()
        promise = new Deferred<string>()
        track = createSourceTrack()
    })

    describe('activate', () => {
        describe('when promise is resolved', () => {
            beforeEach(async () => {
                promise.resolve('test')
                await promise
            })

            it('sets src on PlaybackSource', async () => {
                expect(playbackSource.src).toBeNull()
                track.activate({})
                await flushPromises()
                expect(playbackSource.src).toBe('test')
            })
        })
    })

    describe('deactivate', () => {
        describe('when promise is resolved', () => {
            beforeEach(async () => {
                promise.resolve('test')
                await promise
            })

            it('sets src to null on PlaybackSource and calls load', () => {
                track.activate({})
                track.deactivate()
                expect(playbackSource.src).toBe(null)
                expect(playbackSource.load).toHaveBeenCalledOnceWith()
            })
        })
    })

    describe('toString', () => {
        it('contains the uri', () => {
            expect(track.toString()).toContain(track.uri)
            expect(track.toString()).toContain('SourceTrack')
        })
    })
})

describe('createSourceTrackFactory', () => {
    let trackFactory: TrackFactory<SourceTrackLoadOptions>

    beforeEach(() => {
        trackFactory = createSourceTrackFactory({
            playbackController: new MockPlaybackController(),
            playbackSource: new MockPlaybackSource(),
            drmController: new MockDrmController(),
        })
    })

    it('creates a track factory for SourceTrack', () => {
        const track = trackFactory.createTrack({
            type: 'src',
            uri: 'test',
        })
        expect(track).toBeInstanceOf(SourceTrack)
    })

    describe('when srcProvider is set', () => {
        it('uses the provider to get the uri', async () => {
            const track = trackFactory.createTrack({
                type: 'src',
                uri: 'a',
                srcProvider: () => 'expected',
            }) as SourceTrack
            expect(track).toBeInstanceOf(SourceTrack)
            await expectAsync(track.src).toBeResolvedTo('expected')
        })
    })

    it('validates the track options', () => {
        trackFactory.validate({
            type: 'src',
            uri: 'test',
        })
        expect(() =>
            trackFactory.validate(
                // @ts-expect-error Expected validation error
                {
                    type: 'src',
                }
            )
        ).toThrowError(`property 'uri' is required`)

        expect(() =>
            trackFactory.validate({
                type: 'src',
                uri: 'test',
                srcProvider: () => '',
                config: {
                    qualityMetadata: {
                        // @ts-expect-error Expected string
                        decoderId: 42,
                    },
                },
            })
        ).toThrowError(
            `Expected: type string, but was: 42. At: config.qualityMetadata.decoderId`
        )
    })
})
