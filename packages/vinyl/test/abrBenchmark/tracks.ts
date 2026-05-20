/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const VINYL_ASSETS_HOST = 'https://assets.dev.vinyl.music.amazon.dev'

/*
 * Track playlist for ABR benchmarking.
 */

export interface BenchmarkTrack {
    readonly label: string
    readonly type: 'dash' | 'hls'
    readonly uri: string
}

export const tracks: BenchmarkTrack[] = [
    // {
    //     label: 'aac-hls',
    //     type: 'hls',
    //     uri: `${VINYL_ASSETS_HOST}/hls/live_static_aac_60s_mpegts/main.m3u8`,
    // },
    {
        label: 'audio-10s',
        type: 'dash',
        uri: `${VINYL_ASSETS_HOST}/dash/live_static_aac_opus_flac_60s_segmentBase/manifest.mpd`,
    },
    {
        label: 'video-2s',
        type: 'dash',
        uri: `${VINYL_ASSETS_HOST}/dash/live_static_video_audio_60s_2s_segmentTemplate/manifest.mpd`,
    },
    {
        label: 'video-4s',
        type: 'dash',
        uri: `${VINYL_ASSETS_HOST}/dash/live_static_video_audio_60s_4s_segmentTemplate/manifest.mpd`,
    },
]
