/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy } from '@amazon/vinyl-util'

/**
 * For reliable integ tests on 3P devices, there should be a single media element.
 * When using the media element, unload any sources and reset any state after each test.
 *
 * The element is unmuted at a low volume; see `initializeMediaUnlock`.
 */
export const mediaRef = lazy<HTMLMediaElement>(() => {
    const media = document.createElement('video')
    media.volume = 0.01
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
