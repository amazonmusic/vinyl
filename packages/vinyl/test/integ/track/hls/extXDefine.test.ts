/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createVinylSuite,
    expectPlaylistPlays,
} from '@amazon/vinyl/vinylTestUtil'
import { supportsMse, type VinylTrackLoadOptions } from '@amazon/vinyl'

// An art19 video podcast manifest whose variant and rendition URIs are written
// as {$manifestContentPrefix}…?asid={$art19SessionId} and only resolve once
// EXT-X-DEFINE substitution has run. If the substitution is missing the
// segment URLs will be literally unfetchable.
const ART19_VIDEO_PODCAST =
    'https://manifest.video-content.art19.com/v1/master/72cdbbd9feb362206e4a78c4cf329b96a870550b/art19-video/episodes/383bfc80-7df0-4927-b0f8-0fa2b9f74a7a/video_versions/e56fbc14-5430-4203-afe7-158b3d9ab044/s/ecc6db96-b528-5642-a083-3b4ebe3a879d/video/954bcfab-9317-4f9c-b7f5-ed4031e22a35.m3u8?playerParams.rss_browser=BAhJIgtBbWF6b24GOgZFVA%3D%3D--1c4f96a4b4fa601c7d329c970a4631ae9ec066f3&playerParams.asid=ecc6db96-b528-5642-a083-3b4ebe3a879d'

describe('hls EXT-X-DEFINE integ', () => {
    const playlist: VinylTrackLoadOptions[] = [
        {
            type: 'hls',
            uri: ART19_VIDEO_PODCAST,
        },
    ]
    const suite = createVinylSuite(
        {},
        {
            timeout: 180,
        }
    )

    beforeEach(() => {
        if (!supportsMse()) pending('MSE not supported')
    })

    it('plays a manifest whose URIs are EXT-X-DEFINE templates', async () => {
        await expectPlaylistPlays(suite.player, playlist)
    })
})
