/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MsCommonEme } from './MsCommonEme'
import { StandardCommonEme } from './StandardCommonEme'
import { WebKitCommonEme } from './WebKitCommonEme'
import type { CommonEme } from './CommonEme'
import { globalRef, type Maybe } from '@amazon/vinyl-util'

/**
 * Options for {@link commonEmeFactory}.
 */
export interface CommonEmeFactoryOptions {
    /**
     * If true, the prefixed EME implementations (WebKit, then MS) are preferred
     * over standard EME when available. Otherwise standard EME is preferred and
     * the prefixed implementations are only used when it is unavailable.
     *
     * Default: false
     */
    readonly preferPrefixedMediaKeys?: Maybe<boolean>
}

/**
 * Common EME Factory provides the first supported implementation of CommonEme.
 *
 * The priority is Standard, then WebKit, then MS. If
 * {@link CommonEmeFactoryOptions.preferPrefixedMediaKeys} is true, the priority
 * is WebKit, then MS, then Standard.
 */
export function commonEmeFactory(
    options?: Maybe<CommonEmeFactoryOptions>
): CommonEme | null {
    if (options?.preferPrefixedMediaKeys === true) {
        return createPrefixedCommonEme() ?? createStandardCommonEme()
    }
    return createStandardCommonEme() ?? createPrefixedCommonEme()
}

function createStandardCommonEme(): CommonEme | null {
    return supportsStandardEme() ? new StandardCommonEme() : null
}

function createPrefixedCommonEme(): CommonEme | null {
    if (supportsWebKitEme()) return new WebKitCommonEme()
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
