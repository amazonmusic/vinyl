/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { mediaRef } from '../player/mediaRef'
import { vinylTestAssets } from '../assets/vinylTestAssets'
import { noop } from '@amazon/vinyl-util'

/**
 * In response to a user-gesture, 'unlocks' the media element by playing and immediately pausing a src track.
 * This allows play() to settle on the media element without a user gesture later.
 */
export async function unlockMediaElement() {
    const media = mediaRef.value
    // Unlocks the media element.
    media.src = vinylTestAssets.prog.libmp3lame_60s_2ch_16bit_44100Hz_48kbps
    await media.play().catch(noop)
    media.pause()
    media.removeAttribute('src')
    media.load()
}
