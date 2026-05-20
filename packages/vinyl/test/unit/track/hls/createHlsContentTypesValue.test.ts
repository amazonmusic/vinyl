/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createHlsContentTypesValue,
    type HlsContentTypesValueDeps,
    type HlsManifestData,
} from '@amazon/vinyl'
import type { MainPlaylist } from '@amazon/vinyl-hls-parser'
import { data } from '@amazon/vinyl-observable'
import { mockHlsManifestData } from '@amazon/vinyl/vinylTestUtil'

describe('createHlsContentTypesValue', () => {
    let manifestData: ReturnType<typeof data<Promise<HlsManifestData>>>
    let deps: HlsContentTypesValueDeps

    beforeEach(() => {
        manifestData = data<Promise<HlsManifestData>>(
            Promise.resolve(mockHlsManifestData)
        )
        deps = { manifestTransformed: manifestData }
    })

    function setMainPlaylist(mainPlaylist: MainPlaylist) {
        manifestData.value = Promise.resolve({
            ...mockHlsManifestData,
            mainPlaylist,
        })
    }

    it('returns audio and video for mixed codecs', async () => {
        setMainPlaylist({
            variants: [
                {
                    bandwidth: 1000,
                    uri: 'v.m3u8',
                    codecs: 'avc1.640015,mp4a.40.2',
                },
            ],
            alternativeRenditions: [],
            sessionData: [],
        })
        const result = await createHlsContentTypesValue(deps).value
        expect(result).toEqual(new Set(['video', 'audio']))
    })

    it('returns audio only for audio-only codecs', async () => {
        setMainPlaylist({
            variants: [
                { bandwidth: 128000, uri: 'a.m3u8', codecs: 'mp4a.40.2' },
            ],
            alternativeRenditions: [],
            sessionData: [],
        })
        const result = await createHlsContentTypesValue(deps).value
        expect(result).toEqual(new Set(['audio']))
    })

    it('returns video only for video-only codecs', async () => {
        setMainPlaylist({
            variants: [
                { bandwidth: 1000, uri: 'v.m3u8', codecs: 'avc1.640015' },
            ],
            alternativeRenditions: [],
            sessionData: [],
        })
        const result = await createHlsContentTypesValue(deps).value
        expect(result).toEqual(new Set(['video']))
    })

    it('returns empty set when no variants', async () => {
        setMainPlaylist({
            variants: [],
            alternativeRenditions: [],
            sessionData: [],
        })
        const result = await createHlsContentTypesValue(deps).value
        expect(result).toEqual(new Set())
    })

    it('excludes text content type from codecs', async () => {
        setMainPlaylist({
            variants: [{ bandwidth: 1000, uri: 'v.m3u8', codecs: 'stpp' }],
            alternativeRenditions: [],
            sessionData: [],
        })
        const result = await createHlsContentTypesValue(deps).value
        expect(result).toEqual(new Set())
    })

    it('adds audio from AUDIO renditions', async () => {
        setMainPlaylist({
            variants: [
                { bandwidth: 1000, uri: 'v.m3u8', codecs: 'avc1.640015' },
            ],
            alternativeRenditions: [
                {
                    type: 'AUDIO',
                    groupId: 'aud1',
                    name: 'English',
                    uri: 'audio.m3u8',
                },
            ],
            sessionData: [],
        })
        const result = await createHlsContentTypesValue(deps).value
        expect(result).toEqual(new Set(['video', 'audio']))
    })

    it('adds video from VIDEO renditions', async () => {
        setMainPlaylist({
            variants: [
                { bandwidth: 128000, uri: 'a.m3u8', codecs: 'mp4a.40.2' },
            ],
            alternativeRenditions: [
                {
                    type: 'VIDEO',
                    groupId: 'vid1',
                    name: 'Camera 1',
                    uri: 'video.m3u8',
                },
            ],
            sessionData: [],
        })
        const result = await createHlsContentTypesValue(deps).value
        expect(result).toEqual(new Set(['audio', 'video']))
    })

    it('ignores SUBTITLES renditions', async () => {
        setMainPlaylist({
            variants: [
                { bandwidth: 1000, uri: 'v.m3u8', codecs: 'avc1.640015' },
            ],
            alternativeRenditions: [
                {
                    type: 'SUBTITLES',
                    groupId: 'sub1',
                    name: 'English',
                    uri: 'subs.m3u8',
                },
            ],
            sessionData: [],
        })
        const result = await createHlsContentTypesValue(deps).value
        expect(result).toEqual(new Set(['video']))
    })

    it('ignores CLOSED-CAPTIONS renditions', async () => {
        setMainPlaylist({
            variants: [
                { bandwidth: 1000, uri: 'v.m3u8', codecs: 'avc1.640015' },
            ],
            alternativeRenditions: [
                {
                    type: 'CLOSED-CAPTIONS',
                    groupId: 'cc1',
                    name: 'English',
                },
            ],
            sessionData: [],
        })
        const result = await createHlsContentTypesValue(deps).value
        expect(result).toEqual(new Set(['video']))
    })

    it('deduplicates content types across variants', async () => {
        setMainPlaylist({
            variants: [
                {
                    bandwidth: 500,
                    uri: 'low.m3u8',
                    codecs: 'avc1.640015,mp4a.40.2',
                },
                {
                    bandwidth: 1000,
                    uri: 'high.m3u8',
                    codecs: 'avc1.64001e,mp4a.40.2',
                },
            ],
            alternativeRenditions: [],
            sessionData: [],
        })
        const result = await createHlsContentTypesValue(deps).value
        expect(result).toEqual(new Set(['video', 'audio']))
    })

    it('handles variants without codecs', async () => {
        setMainPlaylist({
            variants: [{ bandwidth: 1000, uri: 'v.m3u8' }],
            alternativeRenditions: [],
            sessionData: [],
        })
        const result = await createHlsContentTypesValue(deps).value
        expect(result).toEqual(new Set())
    })
})
