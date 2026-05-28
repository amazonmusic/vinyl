/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ReadonlyRecord } from '@amazon/vinyl-util'
import {
    DrmKeySystem,
    FAIR_PLAY_KEY_SYSTEMS,
    PLAY_READY_KEY_SYSTEMS,
} from './DrmKeySystem'
import { ContentProtectionScheme } from '@amazon/vinyl-mpd-parser'

/**
 * Given a ContentProtection schemeIdUri, returns the {@link DrmKeySystem} it represents.
 * Not all scheme ids will match to a DrmKeySystem. If none are matched, null is returned.
 * For example, CENC 'urn:mpeg:dash:mp4protection:2011' has no key system and shouldn't be used
 * to create a key session.
 */
export type DrmKeySystemResolver = (
    schemeIdUri: string
) => readonly DrmKeySystem[]

let _defaultSchemeToKeySystem: ReadonlyRecord<
    string,
    readonly DrmKeySystem[]
> | null = null

export function getDefaultSchemeToKeySystem(): ReadonlyRecord<
    string,
    readonly DrmKeySystem[]
> {
    if (_defaultSchemeToKeySystem == null) {
        _defaultSchemeToKeySystem = {
            [ContentProtectionScheme.CLEAR_KEY]: [DrmKeySystem.CLEAR_KEY],
            [ContentProtectionScheme.FAIR_PLAY]: FAIR_PLAY_KEY_SYSTEMS,
            [ContentProtectionScheme.PLAY_READY]: PLAY_READY_KEY_SYSTEMS,
            [ContentProtectionScheme.WIDEVINE]: [DrmKeySystem.WIDEVINE],
        } as const
    }
    return _defaultSchemeToKeySystem
}

export const defaultDrmKeySystemResolver: DrmKeySystemResolver = (
    schemeIdUri: string
) => {
    return getDefaultSchemeToKeySystem()[schemeIdUri.toLowerCase()] ?? []
}
