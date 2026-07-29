/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MainPlaylist, MediaPlaylist } from '@amazon/vinyl-hls-parser'
import type { HlsManifestData } from '@amazon/vinyl'

export const mockMediaPlaylist: MediaPlaylist = {
    version: 7,
    targetDuration: 6,
    mediaSequence: 1,
    playlistType: 'VOD',
    ended: true,
    segments: [
        {
            uri: 'segment0.mp4',
            duration: 6,
            sequenceNumber: 1,
            discontinuity: false,
            map: { uri: 'init.mp4' },
        },
        {
            uri: 'segment1.mp4',
            duration: 6,
            sequenceNumber: 2,
            discontinuity: false,
            map: { uri: 'init.mp4' },
        },
    ],
    dateRanges: [],
}

export const mockMainPlaylist: MainPlaylist = {
    variants: [
        {
            bandwidth: 500000,
            uri: 'low/prog_index.m3u8',
            codecs: 'avc1.640015,mp4a.40.2',
            width: 480,
            height: 270,
            frameRate: 30,
            audioGroup: 'aud1',
        },
        {
            bandwidth: 1000000,
            uri: 'high/prog_index.m3u8',
            codecs: 'avc1.64001e,mp4a.40.2',
            width: 640,
            height: 360,
            frameRate: 30,
            audioGroup: 'aud1',
        },
    ],
    alternativeRenditions: [
        {
            type: 'AUDIO',
            groupId: 'aud1',
            name: 'English',
            uri: 'audio/prog_index.m3u8',
            language: 'en',
            default: true,
            autoSelect: true,
        },
    ],
    sessionData: [],
}

export const mockHlsManifestData: HlsManifestData = {
    mainPlaylist: mockMainPlaylist,
    baseUrl: 'https://example.com/main.m3u8',
    getMediaPlaylist: () => Promise.resolve(mockMediaPlaylist),
}
