/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import '@amazon/vinyl-util/polyfill'
import { createVinylPlayer } from '@amazon/vinyl'

// Select the video element from the page. (This could instead be an audio element.)
const media = document.querySelector('video')!

const player = createVinylPlayer({
    media,
})

player.load({
    type: 'dash',
    uri: `https://assets.dev.vinyl.music.amazon.dev/dash/live_static_video_audio_60s_2s_segmentTemplate/manifest.mpd`,
})
