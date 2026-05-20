/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MsCommonEme } from './MsCommonEme'
import { StandardCommonEme } from './StandardCommonEme'
import { WebKitCommonEme } from './WebKitCommonEme'
import type { CommonEme } from '@/drm/commonEme/CommonEme'
import { globalRef } from '@amazon/vinyl-util'

/**
 * Common EME Factory provides the first supported implementation of CommonEme.
 * The priority is WebKit, Standard, then MS.
 *
 * Note: WebKit if present is currently prioritized over standard for legacy reasons. This may be an obsolete
 * requirement. https://jira.music.amazon.dev/browse/PLAYBACK-6072 ticket to investigate.
 */
export function commonEmeFactory(): CommonEme | null {
    if (supportsWebKitEme()) return new WebKitCommonEme()
    if (supportsStandardEme()) return new StandardCommonEme()
    if (supportsMsEme()) return new MsCommonEme()
    return null
}

/**
 * Tests for Standard Eme support.
 */
export function supportsStandardEme(): boolean {
    return mediaKeySupportRef.value.standardEme
}

/**
 * Tests for WebKitEme support.
 */
export function supportsWebKitEme(): boolean {
    return mediaKeySupportRef.value.webkitEme
}

/**
 * Tests for MsEme support.
 */
export function supportsMsEme(): boolean {
    return mediaKeySupportRef.value.msEme
}

export type MediaKeySupport = {
    readonly standardEme: boolean
    readonly webkitEme: boolean
    readonly msEme: boolean
}

export const mediaKeySupportRef = globalRef<MediaKeySupport>(() => {
    return {
        standardEme: typeof MediaKeys !== 'undefined',
        webkitEme: typeof WebKitMediaKeys !== 'undefined',
        msEme: typeof (global as any).MSMediaKeys !== 'undefined',
    }
})
