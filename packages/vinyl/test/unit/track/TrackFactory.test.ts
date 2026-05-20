/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createTrackFactory,
    type InferLoadOptionsFromFactory,
    type Track,
    type TrackFactory,
    type TrackLoadOptions,
} from '@amazon/vinyl'
import { MockTrack } from '@amazon/vinyl/vinylTestUtil'
import {
    expectNothing,
    expectTypeStrictlyEquals,
} from '@amazon/vinyl-util/browserTestUtil'

describe('createTrackFactory', () => {
    class MockTrack1 extends MockTrack {}
    class MockTrack2 extends MockTrack {}
    class MockTrack3 extends MockTrack {}

    let trackFactory: TrackFactory<TrackLoadOptions>

    beforeEach(() => {
        trackFactory = createTrackFactory({
            key1: {
                validate() {},
                createTrack(options: TrackLoadOptions): Track {
                    const track = new MockTrack1()
                    track.uri = options.uri
                    return track
                },
            },

            key2: {
                validate() {},
                createTrack(options: TrackLoadOptions): Track {
                    const track = new MockTrack2()
                    track.uri = options.uri
                    return track
                },
            },

            key3: {
                validate() {},
                createTrack(options: TrackLoadOptions): Track {
                    const track = new MockTrack3()
                    track.uri = options.uri
                    return track
                },
            },
        })
    })

    it('maps track type keys to their respective factories', () => {
        const track1 = trackFactory.createTrack({ type: 'key1', uri: 'uri1' })
        expect(track1).toBeInstanceOf(MockTrack1)
        expect(track1.uri).toBe('uri1')

        const track2 = trackFactory.createTrack({ type: 'key2', uri: 'uri2' })
        expect(track2).toBeInstanceOf(MockTrack2)
        expect(track2.uri).toBe('uri2')

        const track3 = trackFactory.createTrack({ type: 'key3', uri: 'uri3' })
        expect(track3).toBeInstanceOf(MockTrack3)
        expect(track3.uri).toBe('uri3')
    })

    it('validates type', () => {
        trackFactory.validate({ type: 'key3', uri: 'abc' })
        expect(() =>
            trackFactory.validate({ type: 'non-existent', uri: 'abc' })
        ).toThrowError(
            'Expected: one of: key1 | key2 | key3, but was: "non-existent". At: '
        )
    })

    it('enforces that track factory keys can be assigned to the track type id', () => {
        createTrackFactory({
            key1: {
                validate() {},
                // valid, key1 is assignable to key1
                createTrack(_options: { type: 'key1'; uri: string }): Track {
                    return new MockTrack1()
                },
            },
        })

        createTrackFactory({
            // @ts-expect-error 'key1' is not assignable to 'key2'
            key1: {
                validate() {},
                createTrack(_options: { type: 'key2'; uri: string }): Track {
                    return new MockTrack1()
                },
            },
        })
        expectNothing() // compile-time only check
    })
})

describe('InferLoadOptionsFromFactory', () => {
    it('provides the type of load options for the given factory type', () => {
        type LoadOptions =
            | { type: 'a'; uri: string }
            | { type: 'b'; uri: string }
        expectTypeStrictlyEquals<
            InferLoadOptionsFromFactory<{
                validate(options: LoadOptions): void
                createTrack: (options: LoadOptions) => Track
            }>,
            LoadOptions
        >(true)
    })
})
