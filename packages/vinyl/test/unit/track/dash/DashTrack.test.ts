/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createDashTrackFactory,
    type DashTrackLoadOptions,
    MseTrack,
    type TrackFactory,
} from '@amazon/vinyl'
import { ValidationError } from '@amazon/vinyl-util'
import {
    createMockDashDependencies,
    type MockDashDependencies,
} from '@amazon/vinyl/vinylTestUtil'
import { externalDependencies } from '@amazon/vinyl-di'

const trackLoadOptions: DashTrackLoadOptions = {
    type: 'dash',
    uri: 'http://example.com/manifest.mpd',
}

describe('createDashTrackFactory', () => {
    let trackFactory: TrackFactory<DashTrackLoadOptions>
    let track: MseTrack | null = null
    let deps: MockDashDependencies

    beforeEach(() => {
        track = null
        trackFactory = createDashTrackFactory({
            createDashFactories: () => {
                deps = createMockDashDependencies()
                return externalDependencies(deps)
            },
        })
    })

    afterEach(() => {
        if (track && !track.disposed) track.dispose()
    })

    it('creates a track factory for DashTrack', () => {
        track = trackFactory.createTrack(trackLoadOptions) as MseTrack
        expect(track).toBeInstanceOf(MseTrack)
    })

    it('validates the track options', () => {
        trackFactory.validate({
            type: 'dash',
            uri: 'test',
        })
        expect(() =>
            trackFactory.validate(
                // @ts-expect-error Expected validation error
                {
                    type: 'dash',
                }
            )
        ).toThrowError(ValidationError)

        expect(() =>
            trackFactory.validate({
                type: 'dash',
                uri: 'https://example.com/test.mpd',
                // @ts-expect-error Expected validation error
                requestInit: 3,
            })
        ).toThrowError(ValidationError)
    })
})
