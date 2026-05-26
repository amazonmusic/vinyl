/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { globalRef, lazy } from '@amazon/vinyl-util'

type MaybeAudioContext = typeof AudioContext | undefined

declare global {
    var webkitAudioContext: MaybeAudioContext
}

/**
 * Creates a new AudioContext.
 * Returns null if not supported on this platform.
 */
export function createAudioContext(): AudioContext | null {
    const ctor =
        (global.AudioContext as MaybeAudioContext) ?? global.webkitAudioContext
    return ctor ? new ctor() : null
}

/**
 * Some devices have a hard limit to how many audio context objects can be created.
 * Uses a lazy instance to ensure only one context is created, even within integ tests.
 */
const audioContextSingleton = lazy(createAudioContext)

/**
 * The audio context global reference.
 */
export const audioContextRef = globalRef<AudioContext | null>(
    () => audioContextSingleton.value
)

/**
 * Returns an AudioContext singleton, or returns null if not supported on this platform.
 *
 * If the first time this is called is outside a user gesture, the AudioContext will be unable to start in a
 * running state.
 */
export function getAudioContext(): AudioContext | null {
    return audioContextRef.value
}
