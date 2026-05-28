/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    PlaybackControllerEventMap,
    ReadonlyPlaybackController,
} from './ReadonlyPlaybackController'
import {
    type AnyRecord,
    nextEventAsPromise,
    type NextEventAsPromiseOptions,
} from '@amazon/vinyl-util'

export function nextHasMetadata(
    controller: ReadonlyPlaybackController,
    options?: NextEventAsPromiseOptions<
        PlaybackControllerEventMap,
        'loadedMetadata'
    >
): Promise<AnyRecord> {
    if (controller.hasMetadata) return Promise.resolve({})
    return nextEventAsPromise(controller, 'loadedMetadata', options)
}
