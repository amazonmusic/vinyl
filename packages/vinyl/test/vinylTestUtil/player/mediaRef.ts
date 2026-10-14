/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy } from '@amazon/vinyl-util'

/**
 * The volume integ tests play at: low enough not to be heard, but not 0 or muted. Safari 27 ends progressive
 * playback that starts silently without a user gesture, and the media element is unlocked at this volume.
 */
export const MEDIA_VOLUME = 0.0001

/**
 * For reliable integ tests on 3P devices, there should be a single media element.
 * When using the media element, unload any sources and reset any state after each test.
 *
 * The element is unmuted at {@link MEDIA_VOLUME}; see `initializeMediaUnlock`.
 */
export const mediaRef = lazy<HTMLMediaElement>(() => {
    const media = document.createElement('video')
    media.volume = MEDIA_VOLUME
    media.playsInline = true // needed for iOS
    media.disableRemotePlayback = true // Disables casting. Needed for ManagedMediaSource
    return media
})

afterEach(() => {
    if (mediaRef.constructed) {
        // Reset the media element.
        const media = mediaRef.value
        media.removeAttribute('src')
        media.load()
    }
})
