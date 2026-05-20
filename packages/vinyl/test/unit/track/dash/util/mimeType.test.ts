/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { getRepresentationMimeInfo } from '@amazon/vinyl'
import type { MutableDeep } from '@amazon/vinyl-util'
import { clone } from '@amazon/vinyl-util'
import type {
    AdaptationSetType,
    DashManifest,
    RepresentationType,
} from '@amazon/vinyl-mpd-parser'
import { mockDashManifest } from '@amazon/vinyl/vinylTestUtil'

describe('getRepresentationMimeInfo', () => {
    let manifest: MutableDeep<DashManifest>
    let adaptationSet: MutableDeep<AdaptationSetType>
    let representation: MutableDeep<RepresentationType>

    beforeEach(() => {
        manifest = clone(mockDashManifest)
        adaptationSet = manifest.MPD.Period[0].AdaptationSet![0]
        representation = adaptationSet.Representation![0]
    })

    describe('when mimeType and codecs is present on the representation', () => {
        beforeEach(() => {
            representation.codecs = 'mp4a.40.2'
            representation.mimeType = 'audio/mp4'
        })

        it('composes the mimeType and codecs of the representation', () => {
            const info = getRepresentationMimeInfo(representation)
            expect(info).toEqual({
                mimeType: 'audio/mp4; codecs="mp4a.40.2"',
                contentType: 'audio',
            })
        })
    })

    describe('when mimeType is present on the adaptation set and not on the representation', () => {
        beforeEach(() => {
            adaptationSet.mimeType = 'audio/mp4'
            adaptationSet.codecs = 'mp4a.40.2'
        })

        it('uses the adaptation set mimeType and codecs', () => {
            const info = getRepresentationMimeInfo(representation)
            expect(info).toEqual({
                mimeType: 'audio/mp4; codecs="mp4a.40.2"',
                contentType: 'audio',
            })
        })
    })

    describe('when mimeType is present on both the adaptation set and the representation', () => {
        beforeEach(() => {
            adaptationSet.mimeType = 'notExpectedMimeType'
            representation.mimeType = 'video/mp4'
        })

        it('uses the representation mimeType and codecs', () => {
            adaptationSet.codecs = 'notExpectedCodecs'
            representation.codecs = 'avc1'
            const info = getRepresentationMimeInfo(representation)
            expect(info).toEqual({
                mimeType: 'video/mp4; codecs="avc1"',
                contentType: 'video',
            })
        })

        describe('when codecs is not present', () => {
            it('uses just the mimeType', () => {
                const info = getRepresentationMimeInfo(representation)
                expect(info).toEqual({
                    mimeType: 'video/mp4',
                    contentType: 'video',
                })
            })
        })
    })

    describe('when mimeType is not set', () => {
        describe('and contentType is set', () => {
            it('infers mime type from content type', () => {
                adaptationSet.contentType = 'audio'
                adaptationSet.codecs = 'flac'
                expect(getRepresentationMimeInfo(representation)).toEqual({
                    mimeType: 'audio/mp4; codecs="flac"',
                    contentType: 'audio',
                })

                adaptationSet.contentType = 'video'
                adaptationSet.codecs = 'avc1'
                expect(getRepresentationMimeInfo(representation)).toEqual({
                    mimeType: 'video/mp4; codecs="avc1"',
                    contentType: 'video',
                })
            })
        })

        describe('and contentType is not set but codecs is', () => {
            it('infers content type from codec', () => {
                adaptationSet.codecs = 'mp4a.40.2'
                expect(getRepresentationMimeInfo(representation)).toEqual({
                    mimeType: 'audio/mp4; codecs="mp4a.40.2"',
                    contentType: 'audio',
                })
            })

            it('infers video content type from codec', () => {
                adaptationSet.codecs = 'avc1.640015'
                expect(getRepresentationMimeInfo(representation)).toEqual({
                    mimeType: 'video/mp4; codecs="avc1.640015"',
                    contentType: 'video',
                })
            })
        })

        describe('and contentType is not set and codecs is not set', () => {
            it('returns null mimeType', () => {
                expect(getRepresentationMimeInfo(representation)).toEqual({
                    mimeType: null,
                    contentType: null,
                })
            })
        })

        describe('and contentType is not set and codec is unrecognised', () => {
            it('returns null mimeType', () => {
                adaptationSet.codecs = 'unknown'
                expect(getRepresentationMimeInfo(representation)).toEqual({
                    mimeType: null,
                    contentType: null,
                })
            })
        })
    })

    describe('content type inference from mimeType', () => {
        it('infers audio from audio/ mimeType', () => {
            representation.mimeType = 'audio/mp4'
            const info = getRepresentationMimeInfo(representation)
            expect(info.contentType).toBe('audio')
        })

        it('infers video from video/ mimeType', () => {
            representation.mimeType = 'video/mp4'
            const info = getRepresentationMimeInfo(representation)
            expect(info.contentType).toBe('video')
        })

        it('infers text from text/ mimeType', () => {
            representation.mimeType = 'text/vtt'
            const info = getRepresentationMimeInfo(representation)
            expect(info.contentType).toBe('text')
        })

        it('infers text from application/json', () => {
            representation.mimeType = 'application/json'
            const info = getRepresentationMimeInfo(representation)
            expect(info.contentType).toBe('text')
        })

        it('infers text from application/xml', () => {
            representation.mimeType = 'application/xml'
            const info = getRepresentationMimeInfo(representation)
            expect(info.contentType).toBe('text')
        })

        it('returns null contentType for unknown mimeType', () => {
            representation.mimeType = 'application/octet-stream'
            const info = getRepresentationMimeInfo(representation)
            expect(info.contentType).toBeNull()
        })

        it('prefers adaptationSet contentType over inference', () => {
            representation.mimeType = 'audio/mp4'
            adaptationSet.contentType = 'video'
            const info = getRepresentationMimeInfo(representation)
            expect(info.contentType).toBe('video')
        })
    })

    describe('when mimeType is not set and contentType is audio without codecs', () => {
        it('returns mimeType without codecs', () => {
            adaptationSet.contentType = 'audio'
            expect(getRepresentationMimeInfo(representation)).toEqual({
                mimeType: 'audio/mp4',
                contentType: 'audio',
            })
        })
    })

    describe('when mimeType is not set and contentType is video without codecs', () => {
        it('returns mimeType without codecs', () => {
            adaptationSet.contentType = 'video'
            expect(getRepresentationMimeInfo(representation)).toEqual({
                mimeType: 'video/mp4',
                contentType: 'video',
            })
        })
    })
})
