/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createHlsTrackFactory,
    type HlsTrackLoadOptions,
    MseTrack,
    type TrackFactory,
} from '@amazon/vinyl'
import { ValidationError } from '@amazon/vinyl-util'
import {
    createMockHlsDependencies,
    type MockHlsDependencies,
} from '@amazon/vinyl/vinylTestUtil'
import { externalDependencies } from '@amazon/vinyl-di'

const trackLoadOptions: HlsTrackLoadOptions = {
    type: 'hls',
    uri: 'https://example.com/main.m3u8',
}

describe('createHlsTrackFactory', () => {
    let trackFactory: TrackFactory<HlsTrackLoadOptions>
    let track: MseTrack | null = null
    let deps: MockHlsDependencies

    beforeEach(() => {
        track = null
        trackFactory = createHlsTrackFactory({
            createHlsFactories: () => {
                deps = createMockHlsDependencies()
                return externalDependencies(deps)
            },
        })
    })

    afterEach(() => {
        if (track && !track.disposed) track.dispose()
    })

    it('creates a track factory for HlsTrack', () => {
        track = trackFactory.createTrack(trackLoadOptions) as MseTrack
        expect(track).toBeInstanceOf(MseTrack)
    })

    it('validates the track options', () => {
        trackFactory.validate({
            type: 'hls',
            uri: 'https://example.com/test.m3u8',
        })
        expect(() =>
            trackFactory.validate(
                // @ts-expect-error Expected validation error
                {
                    type: 'hls',
                }
            )
        ).toThrowError(ValidationError)

        expect(() =>
            trackFactory.validate({
                type: 'hls',
                uri: 'https://example.com/test.m3u8',
                // @ts-expect-error Expected validation error
                requestInit: 3,
            })
        ).toThrowError(ValidationError)
    })
})
