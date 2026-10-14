/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { getAudioContext } from '@amazon/vinyl'
import { mediaRef } from '../player/mediaRef'
import { vinylTestAssets } from '../assets/vinylTestAssets'
import { requireUserInteraction } from '../ui/requireUserInteraction'
import { noop } from '@amazon/vinyl-util'

/**
 * The largest timeout jasmine accepts; there is no limit to how long a person may take to click.
 */
const MAX_TIMEOUT_MS = 2_147_483_647

/**
 * 'Unlocks' the media element by playing and immediately pausing a src track, and resumes the AudioContext.
 * This allows play() to settle on the media element without a user gesture later.
 *
 * Must be called synchronously from a user gesture handler. Rejects if the browser did not accept the gesture.
 */
export async function unlockMediaElement(): Promise<void> {
    const media = mediaRef.value
    media.src = vinylTestAssets.prog.libmp3lame_60s_2ch_16bit_44100Hz_48kbps
    const played = media.play()
    const resumed = getAudioContext()?.resume().catch(noop)
    try {
        await played
    } finally {
        media.pause()
        media.removeAttribute('src')
        media.load()
    }
    await resumed
}

/**
 * In a browser, prompts for a click before any spec runs, unlocking the shared media element in response.
 *
 * Starting playback without a user gesture is only allowed for muted media, and some browsers (Safari 27)
 * end progressive playback that starts silently without one, so integ tests play unmuted after this unlock.
 */
export function initializeMediaUnlock() {
    if (typeof document === 'undefined') return
    beforeAll(async () => {
        await requireUserInteraction(unlockMediaElement)
        console.info('Media element unlocked')
    }, MAX_TIMEOUT_MS)
}
