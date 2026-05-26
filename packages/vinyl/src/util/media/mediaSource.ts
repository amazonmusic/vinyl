/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MediaUnsupportedError } from '@amazon/vinyl-util'
import type { Unsubscribe } from '@amazon/vinyl-util'
import type { SignalOptions } from '@amazon/vinyl-util'
import { withTimeout } from '@amazon/vinyl-util'

declare global {
    var ManagedMediaSource: typeof MediaSource | undefined
}

/**
 * Returns true if the UA supports media source extensions.
 */
export function supportsMse(): boolean {
    return (
        typeof ManagedMediaSource === 'function' ||
        typeof MediaSource === 'function'
    )
}

/**
 * Returns ManagedMediaSource or MediaSource.
 */
function getMediaSourceCtor(): typeof MediaSource {
    if (typeof ManagedMediaSource === 'function') return ManagedMediaSource
    else return MediaSource
}

/**
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/MediaSource/isTypeSupported_static)
 */
export function isTypeSupported(type: string): boolean {
    assertMseSupported()
    return getMediaSourceCtor().isTypeSupported(type)
}

/**
 * Constructs a new ManagedMediaSource or MediaSource.
 */
export function createMediaSource(): MediaSource {
    assertMseSupported()
    return new (getMediaSourceCtor())()
}

/**
 * Throws a MediaUnsupportedError if MSE is not supported.
 */
export function assertMseSupported(): void {
    if (!supportsMse())
        throw new MediaUnsupportedError(
            'Media Source Extensions not supported',
            'mse-unsupported'
        )
}

/**
 * Invokes a callback when the media source is open.
 * The callback will be invoked immediately if already open.
 */
export function onMediaSourceOpen(
    mediaSource: MediaSource,
    callback: () => void,
    options?: SignalOptions
): Unsubscribe {
    const open = mediaSource.readyState === 'open'
    if (open) callback()
    const handler = () => callback()
    if (!options?.once || !open) {
        // compatibility note: MediaSource.addEventListener is more widely supported than onsourceopen
        // https://caniuse.com/mdn-api_mediasource_sourceopen_event
        mediaSource.addEventListener('sourceopen', handler, options)
        return () => mediaSource.removeEventListener('sourceopen', handler)
    } else {
        return () => {}
    }
}

/**
 * Invokes a callback when the media source is next ended.
 * The callback will be invoked immediately if already ended.
 */
export function onMediaSourceEnded(
    mediaSource: MediaSource,
    callback: () => void,
    options?: SignalOptions
): Unsubscribe {
    const ended = mediaSource.readyState === 'ended'
    if (ended) callback()
    const handler = () => callback()
    if (!options?.once || !ended) {
        mediaSource.addEventListener('sourceended', handler, options)
        return () => mediaSource.removeEventListener('sourceended', handler)
    } else {
        return () => {}
    }
}

/**
 * Returns a Promise that resolves when the media source is next in an 'ended' state.
 *
 * @param mediaSource
 * @param timeout The number of seconds before rejecting with a TimeoutError.
 * @param timeoutMessage
 */
export function nextMediaSourceEnded(
    mediaSource: MediaSource,
    timeout: number = 5,
    timeoutMessage?: string
): Promise<void> {
    return withTimeout(
        new Promise((resolve) => {
            onMediaSourceEnded(mediaSource, resolve, { once: true })
        }),
        timeout,
        timeoutMessage
    )
}
